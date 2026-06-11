'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWalletContext } from '@/context/WalletContext';
import { getCoinDetail, getCoinChart, formatPercentChange, formatLargeNumber, type CoinDetailData, type ChartData } from '@/lib/coingecko';
import { getSOLBalance, getRecentTransactions } from '@/lib/solana';
import { getTransactions, type TransactionRecord } from '@/lib/storage';
import { formatUSD } from '@/lib/price';
import { Toast } from '@/components/ui/Toast';

type TimeRange = '0.04' | '0.08' | '1' | '7' | '30' | '90' | '365';

interface DisplayTransaction {
  signature: string;
  type: 'send' | 'receive' | 'unknown';
  amount?: number;
  token?: string;
  timestamp: number;
  status: string;
}

export function TokenDetailPage() {
  const { selectedTokenId, setCurrentPage, wallet, rpcEndpoint } = useWalletContext();
  const [coinDetail, setCoinDetail] = useState<CoinDetailData | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('1');
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<DisplayTransaction[]>([]);

  const fetchData = useCallback(async () => {
    if (!selectedTokenId) return;
    setIsLoading(true);
    try {
      const [detail, chart] = await Promise.all([
        getCoinDetail(selectedTokenId),
        getCoinChart(selectedTokenId, parseFloat(timeRange)),
      ]);
      setCoinDetail(detail);
      setChartData(chart);
    } catch {
      // silent fail
    } finally {
      setIsLoading(false);
    }
  }, [selectedTokenId, timeRange]);

  // Fetch wallet balance and transactions
  useEffect(() => {
    const fetchWalletData = async () => {
      if (!wallet) return;

      // Fetch SOL balance
      if (selectedTokenId === 'solana') {
        try {
          const bal = await getSOLBalance(wallet.publicKey, rpcEndpoint);
          setSolBalance(bal);
        } catch {
          setSolBalance(0);
        }
      }

      // Fetch recent transactions
      try {
        const onChainSigs = await getRecentTransactions(wallet.publicKey, 10, rpcEndpoint);
        const localTxs = await getTransactions(wallet.id).catch(() => [] as TransactionRecord[]);

        const displayTxs: DisplayTransaction[] = [];
        const localMap = new Map(localTxs.map((tx) => [tx.signature, tx]));

        // Merge on-chain + local
        for (const sig of onChainSigs) {
          const local = localMap.get(sig.signature);
          if (local) {
            displayTxs.push({
              signature: local.signature,
              type: local.type,
              amount: local.amount,
              token: local.token,
              timestamp: local.timestamp,
              status: local.status,
            });
          } else {
            displayTxs.push({
              signature: sig.signature,
              type: 'unknown',
              timestamp: (sig.blockTime || 0) * 1000,
              status: sig.err ? 'failed' : 'confirmed',
            });
          }
        }

        // Add remaining local not found on-chain
        for (const [sigKey, local] of localMap) {
          if (!onChainSigs.find((s) => s.signature === sigKey)) {
            displayTxs.push({
              signature: local.signature,
              type: local.type,
              amount: local.amount,
              token: local.token,
              timestamp: local.timestamp,
              status: local.status,
            });
          }
        }

        displayTxs.sort((a, b) => b.timestamp - a.timestamp);
        setTransactions(displayTxs.slice(0, 5));
      } catch {
        setTransactions([]);
      }
    };

    fetchWalletData();
  }, [wallet, rpcEndpoint, selectedTokenId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSoon = (feature: string) => {
    setToast({ message: `${feature} - Coming Soon!`, type: 'info' });
  };

  if (!selectedTokenId) {
    setCurrentPage('dashboard');
    return null;
  }

  const price = coinDetail?.market_data?.current_price?.usd || 0;
  const change24h = coinDetail?.market_data?.price_change_percentage_24h || 0;
  const changeFormatted = formatPercentChange(change24h);

  return (
    <div className="min-h-screen flex flex-col bg-[#050a12] animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <button
          onClick={() => setCurrentPage('dashboard')}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={() => handleSoon('Favorite')}
          className="p-2 text-gray-400 hover:text-yellow-400 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </button>
      </div>

      {/* Coin Info Header */}
      <div className="px-5 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {coinDetail?.image?.large && (
              <div className="w-10 h-10 rounded-full overflow-hidden bg-[#1a1a2e]">
                <img src={coinDetail.image.large} alt={coinDetail.name} className="w-10 h-10 object-cover" />
              </div>
            )}
            <div>
              <p className="font-bold text-lg text-white">{coinDetail?.name || selectedTokenId}</p>
              <p className="text-xs text-gray-500">{coinDetail?.symbol?.toUpperCase()}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-lg text-white">{formatUSD(price)}</p>
            <span className={`text-sm font-medium ${changeFormatted.isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {changeFormatted.text}
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="px-4 mb-4">
        <div className="h-[200px] rounded-xl bg-[#0c1929] border border-[#1a3a5c] p-3 flex items-end justify-center overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full w-full">
              <div className="w-6 h-6 border-2 border-gray-700 border-t-cyan-400 rounded-full animate-spin" />
            </div>
          ) : chartData && chartData.prices.length > 0 ? (
            <MiniChart data={chartData.prices} isPositive={change24h >= 0} />
          ) : (
            <p className="text-gray-500 text-sm">Chart unavailable</p>
          )}
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="flex items-center justify-center gap-1.5 px-4 mb-5 flex-wrap">
        {([
          { value: '0.04', label: '1m' },
          { value: '0.08', label: '1H' },
          { value: '1', label: '1D' },
          { value: '7', label: '1W' },
          { value: '30', label: '1M' },
          { value: '90', label: '3M' },
          { value: '365', label: '1Y' },
        ] as { value: TimeRange; label: string }[]).map((item) => (
          <button
            key={item.value}
            onClick={() => setTimeRange(item.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              timeRange === item.value
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Your Balance */}
      <div className="px-5 mb-5">
        <div className="rounded-xl bg-[#0c1929] border border-[#1a2a3a] p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Your balance</span>
            <div className="text-right">
              <p className="font-bold text-white">
                {selectedTokenId === 'solana' ? formatUSD(solBalance * price) : '$0.00'}
              </p>
              <p className="text-xs text-gray-500">
                {selectedTokenId === 'solana'
                  ? `${solBalance === 0 ? '0' : solBalance.toFixed(4)} ${coinDetail?.symbol?.toUpperCase() || 'SOL'}`
                  : `0 ${coinDetail?.symbol?.toUpperCase() || ''}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Send / Receive Buttons */}
      <div className="grid grid-cols-2 gap-3 px-5 mb-6">
        <button
          onClick={() => setCurrentPage('send')}
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1a2a3a] border border-[#2a3a4a] hover:border-cyan-500/50 transition-all"
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
          </svg>
          <span className="text-sm text-white font-medium">Send</span>
        </button>
        <button
          onClick={() => setCurrentPage('receive')}
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1a2a3a] border border-[#2a3a4a] hover:border-cyan-500/50 transition-all"
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
          </svg>
          <span className="text-sm text-white font-medium">Receive</span>
        </button>
      </div>

      {/* Recent Transactions */}
      <div className="px-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Recent Transactions</h3>
          <button
            onClick={() => setCurrentPage('transactions')}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            &gt;
          </button>
        </div>
        {transactions.length > 0 ? (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div key={tx.signature} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm text-white font-medium capitalize">
                    {tx.type === 'send' ? 'Sent' : tx.type === 'receive' ? 'Received' : 'Transaction'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Unknown date'}
                  </p>
                </div>
                <div className="text-right">
                  {tx.amount ? (
                    <p className={`text-sm font-medium ${tx.type === 'receive' ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.type === 'receive' ? '+' : '-'}{tx.amount.toFixed(4)} {tx.token || 'SOL'}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">{tx.signature.slice(0, 8)}...</p>
                  )}
                  <p className={`text-[10px] ${tx.status === 'confirmed' ? 'text-green-500' : tx.status === 'failed' ? 'text-red-500' : 'text-yellow-500'}`}>
                    {tx.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-gray-500 text-sm">No transactions yet</p>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="px-5 mb-6">
        <h3 className="text-sm font-semibold text-white mb-4">Stats</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Market Cap</p>
            <p className="text-sm font-medium text-white">
              {formatLargeNumber(coinDetail?.market_data?.market_cap?.usd)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">24H Volume</p>
            <p className="text-sm font-medium text-white">
              {formatLargeNumber(coinDetail?.market_data?.total_volume?.usd)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Circulating Supply</p>
            <p className="text-sm font-medium text-white">
              {coinDetail?.market_data?.circulating_supply
                ? `${(coinDetail.market_data.circulating_supply / 1_000_000).toFixed(2)}M`
                : '-'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Total Supply</p>
            <p className="text-sm font-medium text-white">
              {coinDetail?.market_data?.total_supply
                ? `${(coinDetail.market_data.total_supply / 1_000_000).toFixed(2)}M`
                : '-'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Max Supply</p>
            <p className="text-sm font-medium text-white">
              {coinDetail?.market_data?.max_supply
                ? `${(coinDetail.market_data.max_supply / 1_000_000).toFixed(2)}M`
                : '-'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Created</p>
            <p className="text-sm font-medium text-white">
              {coinDetail?.genesis_date || '-'}
            </p>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="px-5 pb-10">
        <h3 className="text-sm font-semibold text-white mb-3">About</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {coinDetail?.links?.homepage?.[0] && (
            <a
              href={coinDetail.links.homepage[0]}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1a2a3a] border border-[#2a3a4a] text-xs text-gray-300 hover:border-cyan-500/50 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Website
            </a>
          )}
          {coinDetail?.links?.twitter_screen_name && (
            <a
              href={`https://x.com/${coinDetail.links.twitter_screen_name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1a2a3a] border border-[#2a3a4a] text-xs text-gray-300 hover:border-cyan-500/50 transition-all"
            >
              <span className="font-bold">𝕏</span>
              X
            </a>
          )}
          {coinDetail?.links?.blockchain_site?.[0] && (
            <a
              href={coinDetail.links.blockchain_site[0]}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1a2a3a] border border-[#2a3a4a] text-xs text-gray-300 hover:border-cyan-500/50 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Explorer
            </a>
          )}
        </div>
        {coinDetail?.description?.en && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-4">
            {coinDetail.description.en.replace(/<[^>]*>/g, '').slice(0, 300)}
            {coinDetail.description.en.length > 300 ? '...' : ''}
          </p>
        )}
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

/**
 * Simple SVG line chart component.
 */
function MiniChart({ data, isPositive }: { data: [number, number][]; isPositive: boolean }) {
  if (!data || data.length === 0) return null;

  const prices = data.map((d) => d[1]);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const width = 400;
  const height = 170;
  const padding = 5;

  const points = prices.map((price, i) => {
    const x = padding + (i / (prices.length - 1)) * (width - padding * 2);
    const y = height - padding - ((price - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const strokeColor = isPositive ? '#4ade80' : '#f87171';

  // Area fill
  const areaD = `${pathD} L ${width - padding},${height} L ${padding},${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#chartGradient)" />
      <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
