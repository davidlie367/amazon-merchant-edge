import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { API_BASE } from '../config';
import {
  Menu,
  X,
  LayoutDashboard,
  Layers,
  FileText,
  ClipboardCheck,
  User,
  Wallet,
  Users,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Star,
  CheckCircle2,
  Lock,
  Unlock,
  Copy,
  ArrowRight,
  ArrowUpRight,
  ShieldAlert,
  RefreshCw,
  LogOut,
  Check,
  Bell,
  BellRing,
  Settings,
  HelpCircle,
  Info,
  Download,
  Search,
  Filter,
  Globe,
  QrCode,
  Share2,
  Smartphone,
  TrendingUp,
  Plus,
  Home,
  MessageSquare,
  Send,
  Paperclip
} from 'lucide-react';
import { Product } from '../types';

interface OrderRecord {
  id: string;
  productTitle: string;
  orderId?: string;
  payout: number;
  status: 'Completed' | 'Pending';
  date: string;
  reviewText?: string;
}

interface PlatformStats {
  walletBalance: number;
  completedOrders: number;
  pendingReviews: number;
  profitEarned: number;
  lastResetAt?: string;
  isComboBlocked?: boolean;
  comboDetails?: {
    position: number;
    triggerBalance: number;
    profitAmount: number;
  } | null;
  orders: OrderRecord[];
}

interface DashboardPageProps {
  username: string;
  products: Product[];
  onLogout: () => void;
  showToast: (msg: string) => void;
}

// Fixed assigned products satisfying the strict $0.50 to $2.50 payout requirement
interface AssignedProduct {
  id: string;
  title: string;
  image: string;
  price: number;
  payout: number;
  externalLink: string;
  assignedAt?: string;
}


export default function DashboardPage({
  username,
  onLogout,
  showToast,
}: DashboardPageProps) {
  // Deposits History
  interface DepositRequest {
    id: string;
    protocol: 'TRC-20' | 'ERC-20' | 'BTC';
    amount: number;
    cryptoAmount?: number;
    currency?: string;
    txHash: string;
    remark?: string;
    status: 'Pending' | 'Approved' | 'Rejected';
    date: string;
    platform: 'Amazon' | 'Alibaba' | 'Shopify';
  }

  // Navigation & Layout states
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  });
  const [activeTab, setActiveTab] = useState<'home' | 'deposit' | 'orders' | 'withdraw' | 'profile' | 'invitation' | 'customer-service' | 'terms' | 'about-us' | 'faq'>('home');
  const [selectedOrderCategory, setSelectedOrderCategory] = useState<'Amazon' | 'Alibaba' | 'Shopify' | null>(null);
  const handleTabSwitch = useCallback((tab: typeof activeTab) => {
    setActiveTab(tab);
    if (tab === 'orders') {
      setSelectedOrderCategory(null);
    }
    // Reset Amazon search state when switching tabs
    setAmazonSearchResults([]);
    setAmazonSearchQuery('');
    setAmazonSearchError(null);
    // Reset combo deposit state when switching tabs
    setIsComboDeposit(false);
    setComboDepositAmount(null);
    if (window.innerWidth < 768) {
      setIsSidebarCollapsed(true);
    }
  }, []);
  const [activePlatform, setActivePlatform] = useState<'Amazon' | 'Alibaba' | 'Shopify' | null>(null);
  const activePlatformRef = useRef(activePlatform);
  useEffect(() => { activePlatformRef.current = activePlatform; }, [activePlatform]);
  const [enabledPlatform, setEnabledPlatform] = useState<'Amazon' | 'Alibaba' | 'Shopify' | null>(null);
  const [unlockedPlatforms, setUnlockedPlatforms] = useState<string[]>([]);
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isSubmittingDeposit, setIsSubmittingDeposit] = useState(false);
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isBindingWallet, setIsBindingWallet] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isSavingPIN, setIsSavingPIN] = useState(false);
  const [isSavingAlerts, setIsSavingAlerts] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isComboSuccessModalOpen, setIsComboSuccessModalOpen] = useState(false);
  const [comboSuccessDetails, setComboSuccessDetails] = useState<{ position: number; payout: number; checkpointAmount: number; profitBonus: number } | null>(null);

  // Deposit Request and VIP Unlock States
  const [depositRequests, setDepositRequests] = useState<DepositRequest[]>([]);
  const [selectedProtocol, setSelectedProtocol] = useState<'TRC-20' | 'ERC-20' | 'BTC'>('TRC-20');
  const [depositTargetPlatform, setDepositTargetPlatform] = useState<'Amazon' | 'Alibaba' | 'Shopify'>('Amazon');
  const [comboDepositAmount, setComboDepositAmount] = useState<number | null>(null);
  const [isComboDeposit, setIsComboDeposit] = useState<boolean>(false);
  const [newDepositAmount, setNewDepositAmount] = useState('');
  const [newDepositTxHash, setNewDepositTxHash] = useState('');
  const [newDepositRemark, setNewDepositRemark] = useState('');
  const [unlockedVIPs, setUnlockedVIPs] = useState<Record<'Amazon' | 'Alibaba' | 'Shopify', boolean>>({
    Amazon: true,
    Alibaba: false,
    Shopify: false,
  });

  // Real-time refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>('Never synced');
  const [wsRefreshTick, setWsRefreshTick] = useState(0); // increments on every WS-triggered refresh

  // Amazon Real-Time Product Search state
  const [amazonSearchQuery, setAmazonSearchQuery] = useState('');
  const [amazonSearchResults, setAmazonSearchResults] = useState<any[]>([]);
  const [amazonSearchLoading, setAmazonSearchLoading] = useState(false);
  const [amazonSearchError, setAmazonSearchError] = useState<string | null>(null);

  // Notifications state
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<{ id: any, text: string, type: string, status: string, date: string }[]>(() => {
    const saved = localStorage.getItem(`user_notifications_${username}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) { }
    }
    return [
      { id: 1, text: "Welcome to Amazon Vine Portal!", type: "bonus", status: "unread", date: "Jul 10, 2026" },
    ];
  });

  // Debounce localStorage write for notifications
  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem(`user_notifications_${username}`, JSON.stringify(notifications));
    }, 500);
    return () => clearTimeout(timeout);
  }, [notifications]);

  // Gigs Search and Filters
  const [gigsSearch, setGigsSearch] = useState('');
  const [gigsPage, setGigsPage] = useState(1);

  // Campaigns slider states
  const [allCampaigns, setAllCampaigns] = useState<any[]>([]);
  const [shuffledCampaigns, setShuffledCampaigns] = useState<any[]>([]);
  const sliderRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  // New withdrawal states
  const [newWithdrawAmount, setNewWithdrawAmount] = useState('');
  const [newWithdrawPassword, setNewWithdrawPassword] = useState('');

  // Orders Filter and Search
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<'All' | 'Completed' | 'Pending' | 'Failed'>('All');
  const [ordersSubTab, setOrdersSubTab] = useState<'pending' | 'completed'>('pending');
  const [ordersDateFilter, setOrdersDateFilter] = useState<'All' | 'Last 7 days' | 'This month'>('All');
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<OrderRecord | null>(null);

  // Recent Deposits & Withdrawals for Profile
  const [deposits, setDeposits] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  // Edit Profile States
  const [profile_photo, setProfile_photo] = useState<string | null>(() => {
    return localStorage.getItem(`profile_photo_${username}`);
  });

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1.5 * 1024 * 1024) {
      showToast("File size too large. Please select an image under 1.5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Url = event.target?.result as string;

      const token = localStorage.getItem('reviewer_auth_token');
      try {
        const res = await fetch(`${API_BASE}/auth/update-profile-photo`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ profile_photo: base64Url })
        });

        const data = await res.json();
        if (res.ok) {
          setProfile_photo(base64Url);
          localStorage.setItem(`profile_photo_${username}`, base64Url);
          showToast("✓ Profile photo updated successfully!");
        } else {
          showToast(data.error || "Failed to update profile photo.");
        }
      } catch (err) {
        showToast("Server connection error. Failed to save photo.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAmazonSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!amazonSearchQuery.trim()) {
      showToast("Please enter a search term.");
      return;
    }
    setAmazonSearchLoading(true);
    setAmazonSearchError(null);
    try {
      const token = localStorage.getItem('reviewer_auth_token');
      const response = await fetch(`${API_BASE}/reviews/amazon-search?q=${encodeURIComponent(amazonSearchQuery.trim())}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setAmazonSearchResults(data);
      } else {
        setAmazonSearchError(data.error || "Failed to fetch Amazon products.");
        showToast(data.error || "Failed to fetch Amazon products.");
      }
    } catch (err: any) {
      setAmazonSearchError("Network error. Please try again.");
      showToast("Network error. Please try again.");
    } finally {
      setAmazonSearchLoading(false);
    }
  };

  const [profileActiveSection, setProfileActiveSection] = useState<'details' | 'wallet' | 'security'>('details');
  const [profileEmail, setProfileEmail] = useState(username.toLowerCase().replace(/\s+/g, '') + '@gmail.com');
  const [profilePhone, setProfilePhone] = useState('+1 (555) 019-2831');
  const [profilePassword, setProfilePassword] = useState('password123');
  const [referralCode, setReferralCode] = useState('');
  const [withdrawalPassword, setWithdrawalPassword] = useState('1234');
  const [enable2FA, setEnable2FA] = useState(false);

  // Profile forms password update states
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [oldWithdrawalPassword, setOldWithdrawalPassword] = useState('');
  const [newWithdrawalPassword, setNewWithdrawalPassword] = useState('');
  const [confirmWithdrawalPassword, setConfirmWithdrawalPassword] = useState('');

  // Customer Support Live Chat Box States
  const [chatMessages, setChatMessages] = useState<Array<{ id: string, sender: 'user' | 'support', text: string, time: string }>>(() => {
    const savedChat = sessionStorage.getItem('support_chat_history');
    if (savedChat) {
      try {
        return JSON.parse(savedChat);
      } catch (e) {
        // Fallback to default message
      }
    }
    return [
      {
        id: 'msg-init-1',
        sender: 'support',
        text: 'Hello! Welcome to the Amazon E-Commerce Hub Support Desk. How can we assist you with your account settings, deposits, or evaluations today?',
        time: '10:00 AM'
      }
    ];
  });
  const [chatInputText, setChatInputText] = useState('');
  const [isChatTyping, setIsChatTyping] = useState(false);

  // Use a ref to always hold the latest fetchAllData for WebSocket callback
  const fetchAllDataRef = useRef<() => Promise<any>>(null);

  const fetchAllData = useCallback(async () => {
    const token = localStorage.getItem('reviewer_auth_token');
    if (!token) {
      onLogout();
      return;
    }

    try {
      // Fetch all required data points in parallel
      const [userRes, historyRes, subsRes, chatRes, allRes] = await Promise.all([
        fetch(`${API_BASE}/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/transactions/history`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/reviews/submissions`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/chat/history`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/reviews/products/all`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      // 1. Process User details, balances, and system settings configurations
      if (!userRes.ok) {
        onLogout();
        return;
      }
      const userData = await userRes.json();
      if (!userData) {
        onLogout();
        return;
      }

      // Update balances state
      if (userData.balances) {
        setPlatformsData(prev => ({
          Amazon: {
            ...prev.Amazon,
            walletBalance: userData.balances.Amazon?.walletBalance ?? prev.Amazon.walletBalance,
            completedOrders: userData.balances.Amazon?.completedReviewsCount ?? prev.Amazon.completedOrders,
            lastResetAt: userData.balances.Amazon?.lastResetAt ?? prev.Amazon.lastResetAt,
            isComboBlocked: userData.balances.Amazon?.isComboBlocked ?? prev.Amazon.isComboBlocked,
            comboDetails: userData.balances.Amazon?.comboDetails ?? prev.Amazon.comboDetails,
          },
          Alibaba: {
            ...prev.Alibaba,
            walletBalance: userData.balances.Alibaba?.walletBalance ?? prev.Alibaba.walletBalance,
            completedOrders: userData.balances.Alibaba?.completedReviewsCount ?? prev.Alibaba.completedOrders,
            lastResetAt: userData.balances.Alibaba?.lastResetAt ?? prev.Alibaba.lastResetAt,
            isComboBlocked: userData.balances.Alibaba?.isComboBlocked ?? prev.Alibaba.isComboBlocked,
            comboDetails: userData.balances.Alibaba?.comboDetails ?? prev.Alibaba.comboDetails,
          },
          Shopify: {
            ...prev.Shopify,
            walletBalance: userData.balances.Shopify?.walletBalance ?? prev.Shopify.walletBalance,
            completedOrders: userData.balances.Shopify?.completedReviewsCount ?? prev.Shopify.completedOrders,
            lastResetAt: userData.balances.Shopify?.lastResetAt ?? prev.Shopify.lastResetAt,
            isComboBlocked: userData.balances.Shopify?.isComboBlocked ?? prev.Shopify.isComboBlocked,
            comboDetails: userData.balances.Shopify?.comboDetails ?? prev.Shopify.comboDetails,
          }
        }));

        // Resolve workspace locks dynamically
        const unlocked = userData.unlockedPlatforms || [];
        setUnlockedPlatforms(unlocked);

        if (userData.platform) {
          setEnabledPlatform(userData.platform);
          if (!activePlatform) {
            setActivePlatform(userData.platform);
          }
        } else if (unlocked.length > 0) {
          setEnabledPlatform(null);
          if (!activePlatform) {
            setActivePlatform(unlocked[0]);
          }
        } else {
          // No platform configured — don't default to Amazon
          setEnabledPlatform(null);
          if (activePlatform) setActivePlatform(null);
        }

        // Check for cleared combo checkpoints to show the congratulations modal immediately upon deposit approval
        const activePlat = activePlatform || userData.platform;
        const activePlatData = activePlat ? userData.balances?.[activePlat] : null;
        if (activePlatData?.comboDetails?.isCleared) {
          const comboPos = activePlatData.comboDetails.position;
          const shownKey = `combo_cleared_shown_${userData.id}_${activePlat}_${comboPos}`;
          if (!localStorage.getItem(shownKey)) {
            setComboSuccessDetails({
              position: comboPos,
              checkpointAmount: activePlatData.comboDetails.triggerBalance,
              profitBonus: activePlatData.comboDetails.profitAmount,
              payout: activePlatData.comboDetails.triggerBalance + activePlatData.comboDetails.profitAmount
            });
            setIsComboSuccessModalOpen(true);
            localStorage.setItem(shownKey, 'true');
          }
        }
      }

      // Update bound wallet address mapping state
      if (userData.boundUsdtAddress) {
        setDefaultWalletAddress(userData.boundUsdtAddress);
        setWithdrawAddress(userData.boundUsdtAddress);
        setIsAddressBound(true);
      } else {
        setIsAddressBound(false);
      }

      // Update withdrawal security password state
      if (userData.withdrawalPassword) {
        setWithdrawalPassword(userData.withdrawalPassword);
      }

      // Update dynamic configuration wallets and links
      if (userData.systemConfig) {
        setDepositAddresses({
          'TRC-25': userData.systemConfig.trc20_address || 'TTisWCo1GTszkukUB6gmmdPRaXYsBATJKM',
          'TRC-20': userData.systemConfig.trc20_address || 'TTisWCo1GTszkukUB6gmmdPRaXYsBATJKM',
          'ERC-20': userData.systemConfig.erc20_address || '0xde833b4707431ffa4fcd62da08219172a8360d95',
          'BTC': userData.systemConfig.btc_address || 'bc1q5kt8tzmkvk52xr6ty0n55v5lc0nahwv6xpu8zs'
        });
        if (userData.systemConfig.telegram_link) {
          setTelegramSupportLink(userData.systemConfig.telegram_link);
        }
        if (userData.referralCode) {
          setReferralCode(userData.referralCode);
        }
      }

      if (userData.email) {
        setProfileEmail(userData.email);
      }
      if (userData.phone) {
        setProfilePhone(userData.phone);
      }

      // Update profile photo state from database
      if (userData.profile_photo) {
        setProfile_photo(userData.profile_photo);
        localStorage.setItem(`profile_photo_${username}`, userData.profile_photo);
      } else {
        setProfile_photo(null);
        localStorage.removeItem(`profile_photo_${username}`);
      }

      // 2. Process transaction logs (Deposits & Withdrawals)
      if (historyRes.ok) {
        const rawHistoryData = await historyRes.json();
        const historyData = Array.isArray(rawHistoryData) ? rawHistoryData : [];
        const deps = historyData.filter((x: any) => x && x.type === 'Deposit');
        const withs = historyData.filter((x: any) => x && x.type === 'Withdrawal');
        setDepositRequests(deps.map((dep: any) => ({
          id: dep.id,
          protocol: dep.protocol || 'TRC-20',
          amount: parseFloat(dep.amount) || 0,
          cryptoAmount: dep.cryptoAmount ?? dep.crypto_amount ?? (parseFloat(dep.amount) || 0),
          currency: dep.currency || (dep.protocol === 'BTC' ? 'BTC' : 'USDT'),
          txHash: dep.txHash || dep.tx_hash || '',
          remark: dep.remark,
          status: dep.status || 'Pending',
          date: dep.date || new Date(dep.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
          platform: dep.platform || 'Amazon'
        })));
        setDeposits(deps);
        setWithdrawals(withs);
      }

      // 3. Process review submissions history to merge in platform logs
      if (subsRes.ok) {
        const rawSubsData = await subsRes.json();
        const subsData = Array.isArray(rawSubsData) ? rawSubsData : [];
        setPlatformsData(prev => {
          const amzOrders = subsData.filter((x: any) => x && x.platform === 'Amazon');
          const aliOrders = subsData.filter((x: any) => x && x.platform === 'Alibaba');
          const shoOrders = subsData.filter((x: any) => x && x.platform === 'Shopify');

          const sumPayout = (orders: any[]) => {
            return orders
              .filter((o: any) => o && o.status === 'Completed')
              .reduce((sum: number, o: any) => sum + (o.payout || 0), 0);
          };

          return {
            Amazon: {
              ...prev.Amazon,
              orders: amzOrders,
              completedOrders: amzOrders.filter((o: any) => o && o.status === 'Completed').length,
              pendingReviews: amzOrders.filter((o: any) => o && o.status === 'Pending').length,
              profitEarned: Number(sumPayout(amzOrders).toFixed(2))
            },
            Alibaba: {
              ...prev.Alibaba,
              orders: aliOrders,
              completedOrders: aliOrders.filter((o: any) => o && o.status === 'Completed').length,
              pendingReviews: aliOrders.filter((o: any) => o && o.status === 'Pending').length,
              profitEarned: Number(sumPayout(aliOrders).toFixed(2))
            },
            Shopify: {
              ...prev.Shopify,
              orders: shoOrders,
              completedOrders: shoOrders.filter((o: any) => o && o.status === 'Completed').length,
              pendingReviews: shoOrders.filter((o: any) => o && o.status === 'Pending').length,
              profitEarned: Number(sumPayout(shoOrders).toFixed(2))
            }
          };
        });
      }

      // 4. Process chat logs
      if (chatRes.ok) {
        const rawChatData = await chatRes.json();
        const chatData = Array.isArray(rawChatData) ? rawChatData : [];
        setChatMessages(chatData);
      }

      // 5. Process all campaigns for available campaigns pool slider
      if (allRes.ok) {
        const rawAllData = await allRes.json();
        const allData = Array.isArray(rawAllData) ? rawAllData : [];
        setAllCampaigns(allData.map((p: any) => ({
          id: p.id,
          title: p.title,
          image: p.image_url,
          payout: parseFloat(p.payout) || 0,
          price: parseFloat(p.price) || 0
        })));
      }

      setLastRefreshed(new Date().toLocaleTimeString());
      return userData;
    } catch (err) {
      console.warn("Active session data sync error:", err);
      return null;
    } finally {
      setIsDataLoading(false);
    }
  }, [onLogout]);

  // Keep ref current so WebSocket callback always calls latest version
  useEffect(() => {
    fetchAllDataRef.current = fetchAllData;
  }, [fetchAllData]);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 60000);
    return () => clearInterval(interval);
  }, []); // fetchAllData fetches ALL platforms — no need to re-run on platform switch

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let isCleanCleanup = false;
    let consecutiveFailures = 0;

    function connectWS() {
      const token = localStorage.getItem('reviewer_auth_token');
      if (!token) return;

      // Stop reconnecting after too many failures (token likely expired)
      if (consecutiveFailures >= 3) {
        console.error("WebSocket: Too many connection failures, stopping reconnection. Please re-login.");
        return;
      }

      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let wsHost = 'localhost:5000';
      try {
        if (API_BASE.startsWith('http')) {
          const urlObj = new URL(API_BASE);
          wsHost = urlObj.host;
        } else {
          wsHost = window.location.host;
        }
      } catch (e) {
        if (API_BASE.includes('localhost')) {
          wsHost = 'localhost:5000';
        } else {
          wsHost = window.location.host;
        }
      }

      const wsUrl = `${wsProto}//${wsHost}?token=${encodeURIComponent(token)}`;
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (
            message.type === 'balance_update' ||
            message.type === 'approval_notice' ||
            message.type === 'vip_unlocked' ||
            message.type === 'vip_locked' ||
            message.type === 'vip_configured' ||
            message.type === 'new_chat_message'
          ) {
            // Use ref to always call latest fetchAllData (avoids stale closure)
            if (fetchAllDataRef.current) fetchAllDataRef.current();
            // Signal assigned products to re-fetch IMMEDIATELY
            setWsRefreshTick(t => t + 1);

            // CRITICAL: On vip_locked (batch reset), immediately clear assigned products
            // so user CANNOT submit reviews on deleted products
            const payloadType = message.data?.type || message.type;
            if (payloadType === 'vip_locked' || payloadType === 'vip_configured' || payloadType === 'new_orders_assigned' || payloadType === 'vip_unlocked') {
              // Force re-fetch assigned products for active platform
              const token = localStorage.getItem('reviewer_auth_token');
              const currentPlat = activePlatformRef.current;
              if (token && currentPlat) {
                fetch(`${API_BASE}/reviews/products?platform=${currentPlat}`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                })
                  .then(res => res.json())
                  .then(data => {
                    if (Array.isArray(data)) {
                      setAssignedProducts(data.map((p: any) => ({
                        id: p.id,
                        title: p.title,
                        image: p.image_url,
                        price: parseFloat(p.price) || 0,
                        payout: parseFloat(p.payout),
                        externalLink: p.external_link,
                        assignedAt: p.assignedAt || new Date(0).toISOString()
                      })));
                    } else {
                      setAssignedProducts([]);
                    }
                  })
                  .catch(() => {
                    setAssignedProducts([]);
                  });
              }
            }

            let notifText = '';
            let notifType = 'system';

            if (message.type === 'balance_update') {
              const payload = message.data;
              notifType = payload.type || 'bonus';
              if (payload.type === 'bonus') {
                notifText = `🎉 Admin granted you a $${parseFloat(payload.amount).toFixed(2)} bonus!`;
              } else if (payload.type === 'deposit') {
                notifText = `💰 Your deposit of $${parseFloat(payload.amount).toFixed(2)} was ${payload.status}!`;
              } else if (payload.type === 'withdrawal') {
                if (payload.status === 'Approved') {
                  notifText = `✅ Your withdrawal request of $${parseFloat(payload.amount).toFixed(2)} was Approved!`;
                } else {
                  notifText = `❌ Your withdrawal request of $${parseFloat(payload.amount).toFixed(2)} was Rejected. Balance refunded.`;
                }
              } else if (payload.type === 'vip_unlocked') {
                notifText = `🔓 Category ${payload.platform} has been Unlocked for you!`;
                notifType = 'vip';
              } else if (payload.type === 'vip_locked') {
                notifText = `🔒 Category ${payload.platform} has been Locked by the Admin.`;
                notifType = 'vip';
              } else if (payload.type === 'vip_configured') {
                notifText = `⚙️ New campaigns have been configured for you.`;
                notifType = 'vip';
              } else if (payload.type === 'balance_adjustment') {
                notifText = `👛 Admin updated your wallet balance to $${parseFloat(payload.balance).toFixed(2)} USD!`;
                notifType = 'wallet';
              }
            } else if (message.type === 'vip_unlocked') {
              notifText = `🔓 Category ${message.data.platform} has been Unlocked for you!`;
              notifType = 'vip';
            } else if (message.type === 'vip_locked') {
              notifText = `🔒 Category ${message.data.platform} has been Locked by the Admin.`;
              notifType = 'vip';
            } else if (message.type === 'vip_configured') {
              notifText = `⚙️ New campaigns have been configured for you.`;
              notifType = 'vip';
            }

            if (notifText) {
              setNotifications(prev => [
                {
                  id: Date.now(),
                  text: notifText,
                  type: notifType,
                  status: 'unread',
                  date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                },
                ...prev
              ]);
              showToast(notifText);
            } else if (message.type === 'new_chat_message') {
              // Admin sent a message — re-fetch chat history
              const token = localStorage.getItem('reviewer_auth_token');
              if (token) {
                fetch(`${API_BASE}/chat/history`, { headers: { 'Authorization': `Bearer ${token}` } })
                  .then(res => res.json())
                  .then(data => {
                    if (Array.isArray(data)) setChatMessages(data);
                  })
                  .catch(() => {});
              }
              showToast(`💬 New message from support: ${message.data?.text || ''}`);
            } else {
              showToast(`⚡ Real-time workspace updates synchronized successfully.`);
            }
          }
        } catch (err) {
          console.error("Error handling real-time socket packet:", err);
        }
      };

      ws.onerror = (err) => {
        if (!isCleanCleanup) {
          console.warn("Real-time WebSocket connection temporarily offline. Retrying...");
        }
      };

      ws.onopen = () => {
        consecutiveFailures = 0;
      };

      ws.onclose = () => {
        if (!isCleanCleanup) {
          consecutiveFailures++;
          const delay = Math.min(5000 * consecutiveFailures, 30000);
          reconnectTimeout = setTimeout(connectWS, delay);
        }
      };
    }

    connectWS();

    return () => {
      isCleanCleanup = true;
      if (ws) {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Shuffling effect for Available Campaigns Pool — only reshuffle when allCampaigns actually changes
  useEffect(() => {
    if (allCampaigns.length === 0) return;
    setShuffledCampaigns([...allCampaigns].sort(() => Math.random() - 0.5));
    const interval = setInterval(() => {
      setShuffledCampaigns(prev => {
        if (prev.length <= 1) return prev;
        // Fisher-Yates partial shuffle (swap 2 random elements only)
        const next = [...prev];
        const i = Math.floor(Math.random() * next.length);
        const j = Math.floor(Math.random() * next.length);
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      });
    }, 10000); // Increased from 7s to 10s to reduce render churn
    return () => clearInterval(interval);
  }, [allCampaigns.length]); // Only re-run when count changes, not on content change

  // Scroll arrow dynamic visibility logic
  const handleScroll = () => {
    if (sliderRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = sliderRef.current;
      setShowLeftArrow(scrollLeft > 5);
      setShowRightArrow(scrollWidth - scrollLeft - clientWidth > 5);
    }
  };

  const scrollSlider = (direction: 'left' | 'right') => {
    if (sliderRef.current) {
      const { clientWidth } = sliderRef.current;
      const scrollAmount = direction === 'left' ? -clientWidth * 0.75 : clientWidth * 0.75;
      sliderRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    requestAnimationFrame(handleScroll);
  }, [shuffledCampaigns]);

  // Handle new secure cashout withdrawal request submission
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingWithdraw) return;
    const amount = parseFloat(newWithdrawAmount);
    if (isNaN(amount) || amount < 1) {
      showToast("Minimum withdrawal is $1.00.");
      return;
    }
    if (amount > currentPlatformData.walletBalance) {
      showToast("Insufficient wallet balance.");
      return;
    }
    if (!newWithdrawPassword.trim()) {
      showToast("Please enter your withdrawal password.");
      return;
    }
    if (newWithdrawPassword !== withdrawalPassword) {
      showToast("Error: Incorrect withdrawal password.");
      return;
    }

    setIsSubmittingWithdraw(true);
    try {
      const token = localStorage.getItem('reviewer_auth_token');
      const res = await fetch(`${API_BASE}/transactions/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          platform: activePlatform,
          amount: amount
        })
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Withdrawal submission failed');
        return;
      }

      setNewWithdrawAmount('');
      setNewWithdrawPassword('');
      showToast(`✓ Withdrawal request for $${amount.toFixed(2)} submitted successfully!`);
      fetchAllData();
    } catch (err) {
      showToast('Server connection error. Failed to submit withdrawal.');
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  useEffect(() => {
    if (!activePlatform) {
      setAssignedProducts([]);
      return;
    }

    const token = localStorage.getItem('reviewer_auth_token');
    if (!token) return;

    fetch(`${API_BASE}/reviews/products?platform=${activePlatform}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAssignedProducts(data.map((p: any) => ({
            id: p.id,
            title: p.title,
            image: p.image_url,
            price: parseFloat(p.price) || 0,
            payout: parseFloat(p.payout),
            externalLink: p.external_link,
            assignedAt: p.assignedAt || new Date(0).toISOString()
          })));
        } else {
          setAssignedProducts([]);
        }
      })
      .catch(() => {
        setAssignedProducts([]);
      });
  }, [activePlatform, wsRefreshTick]); // Re-fetch when WS signals new data OR platform changes

  // Settings States
  const [settingsUsername, setSettingsUsername] = useState(username);
  const [settingsEmail, setSettingsEmail] = useState(username.toLowerCase().replace(/\s+/g, '') + '@gmail.com');
  const [settingsPassword, setSettingsPassword] = useState('');
  const [emailNotifToggle, setEmailNotifToggle] = useState(true);
  const [telegramNotifToggle, setTelegramNotifToggle] = useState(false);
  const [browserNotifToggle, setBrowserNotifToggle] = useState(true);
  const [defaultWalletAddress, setDefaultWalletAddress] = useState('');
  const [isAddressBound, setIsAddressBound] = useState(false);
  const [defaultNetwork, setDefaultNetwork] = useState('TRC-20');
  const [settingsLanguage, setSettingsLanguage] = useState('English');
  const [settingsTimezone, setSettingsTimezone] = useState('UTC+5');

  // Combo system warning modal states
  const [isComboModalOpen, setIsComboModalOpen] = useState(false);
  const [comboModalDetails, setComboModalDetails] = useState<{
    triggerBalance: number;
    profitAmount: number;
    currentBalance: number;
    position: number;
  } | null>(null);

  // Interactive settings and help tabs states
  const [settingsSubTab, setSettingsSubTab] = useState<'account' | 'notifications' | 'wallet' | 'danger'>('account');
  const [faqSearch, setFaqSearch] = useState('');
  const [activeFaqId, setActiveFaqId] = useState<number | null>(null);

  // Separated balances/orders per platform so they NEVER mix. Starting with 0 balance for network lock flow
  const [platformsData, setPlatformsData] = useState<Record<'Amazon' | 'Alibaba' | 'Shopify', PlatformStats>>({
    Amazon: {
      walletBalance: 0.00,
      completedOrders: 0,
      pendingReviews: 0,
      profitEarned: 0.00,
      orders: []
    },
    Alibaba: {
      walletBalance: 0.00,
      completedOrders: 0,
      pendingReviews: 0,
      profitEarned: 0.00,
      orders: []
    },
    Shopify: {
      walletBalance: 0.00,
      completedOrders: 0,
      pendingReviews: 0,
      profitEarned: 0.00,
      orders: []
    }
  });

  // Review step-by-step wizard state
  const [activeReviewProduct, setActiveReviewProduct] = useState<AssignedProduct | null>(null);
  const [reviewStep, setReviewStep] = useState<1 | 2 | 3 | 4>(1);
  const [inputOrderId, setInputOrderId] = useState('');
  const [reviewDraftText, setReviewDraftText] = useState('');
  const [reviewStars, setReviewStars] = useState(0);
  const [selectedTextCode, setSelectedTextCode] = useState<string | null>(null);

  // Profile details
  const [cryptoNetwork, setCryptoNetwork] = useState('TRC-20');
  const [depositAddresses, setDepositAddresses] = useState<Record<string, string>>({
    'TRC-20': 'TTisWCo1GTszkukUB6gmmdPRaXYsBATJKM',
    'ERC-20': '0xde833b4707431ffa4fcd62da08219172a8360d95',
    'BTC': 'bc1q5kt8tzmkvk52xr6ty0n55v5lc0nahwv6xpu8zs'
  });
  const [telegramSupportLink, setTelegramSupportLink] = useState('https://t.me/Customerservicecentre01');
  const [assignedProducts, setAssignedProducts] = useState<AssignedProduct[]>([]);

  // Withdraw request modal (only relevant when they click Withdraw, although locked unless 25+ orders)
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');

  const currentPlatformData = useMemo(() => {
    if (activePlatform) return platformsData[activePlatform];
    // No active platform — find first one with a non-zero balance
    const platforms = ['Amazon', 'Alibaba', 'Shopify'] as const;
    for (const p of platforms) {
      if (platformsData[p].walletBalance > 0) return platformsData[p];
    }
    return { walletBalance: 0, completedOrders: 0, pendingReviews: 0, profitEarned: 0, lastResetAt: undefined, isComboBlocked: false, comboDetails: null, orders: [] };
  }, [activePlatform, platformsData]);

  // Helper to copy text to clipboard
  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard!`);
  };

  // Handle active category selection
  const handleSelectPlatform = useCallback((platform: 'Amazon' | 'Alibaba' | 'Shopify') => {
    if (unlockedPlatforms.length <= 1 && enabledPlatform && enabledPlatform !== platform) {
      showToast(`Workspace locked to ${enabledPlatform}. You cannot switch to another network.`);
      return;
    }
    setActivePlatform(platform);
    showToast(`Switched workspace to ${platform}. loaded corresponding tasks.`);
  }, [unlockedPlatforms, enabledPlatform, showToast]);

  // Real-time synchronization
  const handleRefreshBalance = useCallback(() => {
    setIsRefreshing(true);
    fetchAllData().finally(() => {
      setIsRefreshing(false);
      showToast(`Real-time balances synchronized successfully with decentralized ledger nodes!`);
    });
  }, [fetchAllData, showToast]);

  // Export orders to CSV
  const handleDownloadCSV = () => {
    const headers = ["Order Record ID", "Merchant Item", "Order ID Ref", "Payout Amount", "Status", "Date", "Feedback Review"];
    const rows = currentPlatformData.orders.map(o => [
      o.id,
      `"${o.productTitle.replace(/"/g, '""')}"`,
      o.orderId || "N/A",
      o.payout.toFixed(2),
      o.status,
      o.date,
      `"${(o.reviewText || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `zonreview_${activePlatform.toLowerCase()}_earnings.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Successfully exported ${activePlatform} compliance ledger to CSV!`);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingPassword) return;
    if (oldPassword !== profilePassword) {
      showToast("Error: Current login password does not match.");
      return;
    }
    if (newPassword.length < 8) {
      showToast("Error: New login password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Error: Confirm password does not match new password.");
      return;
    }
    setIsSavingPassword(true);
    setTimeout(() => {
      setProfilePassword(newPassword);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast("✓ Login security password changed successfully.");
      setIsSavingPassword(false);
    }, 500);
  };

  const handleChangeWithdrawalPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingPIN) return;
    if (oldWithdrawalPassword !== withdrawalPassword) {
      showToast("Error: Current withdrawal PIN does not match.");
      return;
    }
    if (!/^\d{4}$/.test(newWithdrawalPassword)) {
      showToast("Error: New withdrawal PIN must be exactly 4 digits.");
      return;
    }
    if (newWithdrawalPassword !== confirmWithdrawalPassword) {
      showToast("Error: Confirm withdrawal PIN does not match new withdrawal PIN.");
      return;
    }
    setIsSavingPIN(true);
    setTimeout(() => {
      setWithdrawalPassword(newWithdrawalPassword);
      setOldWithdrawalPassword('');
      setNewWithdrawalPassword('');
      setConfirmWithdrawalPassword('');
      showToast("✓ Withdrawal PIN changed successfully.");
      setIsSavingPIN(false);
    }, 500);
  };

  const triggerUserImageAttach = () => {
    document.getElementById('userImageAttachInput')?.click();
  };

  const handleUserImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast("File is too large. Please select an image under 10MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target.result as string;
      try {
        showToast("Uploading attachment screenshot...");
        const token = localStorage.getItem('reviewer_auth_token');
        const res = await fetch(`${API_BASE}/chat/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ image: base64 })
        });
        const data = await res.json();

        if (res.ok) {
          const optMsg = {
            id: `msg-opt-${Date.now()}`,
            sender: 'user' as const,
            text: data.imageUrl,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          setChatMessages(prev => [...prev, optMsg]);

          const sendRes = await fetch(`${API_BASE}/chat/send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              text: data.imageUrl,
              time: optMsg.time
            })
          });
          if (sendRes.ok) {
            showToast("✓ Image uploaded successfully!");
            const chatRes = await fetch(`${API_BASE}/chat/history`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (chatRes.ok) {
              const chatData = await chatRes.json();
              setChatMessages(chatData);
            }
          }
        } else {
          showToast(data.error || "Failed to upload image.");
        }
      } catch (err) {
        showToast("Image upload server connection error.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInputText.trim()) return;

    const userMsgText = chatInputText;
    setChatInputText('');

    const timeVal = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const optMsg = {
      id: `msg-opt-${Date.now()}`,
      sender: 'user' as const,
      text: userMsgText,
      time: timeVal
    };
    setChatMessages(prev => [...prev, optMsg]);

    try {
      const token = localStorage.getItem('reviewer_auth_token');
      const res = await fetch(`${API_BASE}/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: userMsgText,
          time: timeVal
        })
      });

      if (res.ok) {
        const chatRes = await fetch(`${API_BASE}/chat/history`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (chatRes.ok) {
          const chatData = await chatRes.json();
          setChatMessages(chatData);
        }
      } else {
        showToast("Failed to transmit support message.");
      }
    } catch (err) {
      showToast("Support message transmission network error.");
    }
  };

  // Notification actions
  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, status: 'read' })));
    showToast("All notifications marked as read.");
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    showToast("Cleared all notifications.");
  };

  const markNotificationRead = (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'read' } : n));
  };

  // Progress tracker functions
  const startReviewFlow = (product: AssignedProduct) => {
    if (currentPlatformData.isComboBlocked && currentPlatformData.comboDetails) {
      setComboModalDetails({
        triggerBalance: currentPlatformData.comboDetails.triggerBalance,
        profitAmount: currentPlatformData.comboDetails.profitAmount,
        currentBalance: currentPlatformData.walletBalance,
        position: currentPlatformData.comboDetails.position
      });
      setIsComboModalOpen(true);
      showToast("⚠️ Special Combo Order is locked! Please complete payment to continue.");
      return;
    }
    setActiveReviewProduct(product);
    setReviewStep(1);
    setInputOrderId('');
    setReviewDraftText('');
    setReviewStars(0);
    setSelectedTextCode(null);
  };

  const handleStep1Complete = () => {
    setReviewStep(2);
    showToast("Product acquisition registered. Please submit your Order ID.");
  };

  const handleStep2Complete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputOrderId.trim()) {
      showToast("Please enter a valid Order ID.");
      return;
    }
    setReviewStep(3);
    showToast("Order ID registered. Payout pending verification. Write review.");
  };

  const handleStep3Complete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReviewProduct) return;
    if (reviewStars < 1 || reviewStars > 5) {
      showToast("Please select a star rating between 1 and 5.");
      return;
    }
    if (!selectedTextCode) {
      showToast("Please select a feedback text template.");
      return;
    }

    setIsSubmittingReview(true);
    try {
      const token = localStorage.getItem('reviewer_auth_token');
      const randomOrderId = 'ORD-' + Math.random().toString(36).substring(2, 12).toUpperCase();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${API_BASE}/reviews/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          productId: activeReviewProduct.id,
          orderId: randomOrderId,
          reviewText: selectedTextCode
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await res.json();

      if (!res.ok) {
        setIsSubmittingReview(false);
        if (data.error === 'COMBO_BLOCK' || res.status === 403) {
          setComboModalDetails({
            triggerBalance: data.triggerBalance || 0,
            profitAmount: data.profitAmount || 0,
            currentBalance: data.currentBalance || 0,
            position: data.position || 0
          });
          setIsComboModalOpen(true);
          return;
        }
        // If already submitted in this batch, silently advance to next product
        if (data.error && data.error.includes('already submitted')) {
          const remainingPending = assignedProducts.filter(p => {
            if (p.id === activeReviewProduct.id) return false;
            return !currentPlatformData.orders.some(o =>
              o.productId === p.id &&
              o.status === 'Completed' &&
              new Date(o.createdAt).getTime() >= new Date(currentPlatformData.lastResetAt || 0).getTime()
            );
          });
          const nextProduct = remainingPending[0] || null;
          setActiveReviewProduct(nextProduct);
          if (nextProduct) setReviewStep(1);
          setReviewStars(0);
          setSelectedTextCode(null);
          setIsSubmittingReview(false);
          fetchAllData().catch(() => {});
          return;
        }
        showToast(data.error || 'Submission failed');
        return;
      }

      const actualPayout = data.payoutEarned !== undefined ? data.payoutEarned : activeReviewProduct.payout;
      
      // Optimistically update completedOrders and walletBalance immediately from server response
      const activePlat = activePlatform || enabledPlatform || 'Amazon';
      if (data.completedReviewsCount !== undefined || data.walletBalance !== undefined) {
        setPlatformsData(prev => ({
          ...prev,
          [activePlat]: {
            ...prev[activePlat],
            completedOrders: data.completedReviewsCount !== undefined ? data.completedReviewsCount : prev[activePlat].completedOrders,
            walletBalance: data.walletBalance !== undefined ? data.walletBalance : prev[activePlat].walletBalance
          }
        }));
      }

      showToast(`✓ Evaluation submitted successfully! +$${actualPayout.toFixed(2)} USD credited.`);

      // Optimistically add the new submission to orders immediately
      const newOrder = {
        id: data.submission?.id || Date.now().toString(),
        productId: activeReviewProduct.id,
        productTitle: activeReviewProduct.title,
        productImage: activeReviewProduct.image,
        status: 'Completed',
        payout: actualPayout,
        createdAt: new Date().toISOString(),
        platform: activePlatform || 'Amazon'
      };
      setPlatformsData(prev => ({
        ...prev,
        [activePlat]: {
          ...prev[activePlat],
          orders: [...prev[activePlat].orders, newOrder]
        }
      }));

      // Clear input state parameters
      setReviewStars(0);
      setSelectedTextCode(null);

      // ============================================================
      // COMBO CHECKPOINT INTERCEPT
      // If submitting this review triggered a Special Combo checkpoint for the next campaign
      // (i.e. the NEXT position is now a pending/unpaid combo), STOP the
      // auto-advance, close the review wizard, and surface the Combo modal.
      // ============================================================
      if (data.nextComboBlocked && data.nextComboDetails) {
        setActiveReviewProduct(null); // close the review wizard — no auto-advance
        setComboModalDetails({
          triggerBalance: data.nextComboDetails.triggerBalance,
          profitAmount: data.nextComboDetails.profitAmount,
          currentBalance: data.nextComboDetails.currentBalance || 0,
          position: data.nextComboDetails.position
        });
        setIsComboModalOpen(true);
        showToast("⚠️ Special Combo Order triggered! Please complete the payment to continue.");
        setIsSubmittingReview(false);
        // Refresh all user data in the background asynchronously
        fetchAllData().catch(err => { console.log('Background reload error:', err); });
        return;
      }

      // No combo triggered — proceed with normal auto-advance to next campaign product.
      const remainingPending = assignedProducts.filter(p => {
        if (p.id === activeReviewProduct.id) return false;
        return !currentPlatformData.orders.some(o =>
          o.productId === p.id &&
          o.status === 'Completed' &&
          new Date(o.createdAt).getTime() >= new Date(currentPlatformData.lastResetAt || 0).getTime()
        );
      });

      const nextProduct = remainingPending[0] || null;
      if (nextProduct) {
        setActiveReviewProduct(nextProduct);
        setReviewStep(1);
      } else {
        setActiveReviewProduct(null);
        showToast("✓ All assigned campaigns for today have been completed!");
      }

      setIsSubmittingReview(false);
      // Refresh all user data in the background asynchronously
      fetchAllData().catch(err => { console.log('Background reload error:', err); });
    } catch (err) {
      setIsSubmittingReview(false);
      if (err.name === 'AbortError') {
        showToast('Request timed out. Please try again.');
      } else {
        showToast('Server connection error. Failed to submit evaluation.');
      }
    }
  };


  // Handle withdraw submission
  const handleWithdrawRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingWithdraw) return;
    if (currentPlatformData.isComboBlocked && currentPlatformData.comboDetails) {
      showToast("❌ Withdrawal locked! Please pay and complete your pending Special Combo order first.");
      return;
    }
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast("Please enter a valid withdrawal amount.");
      return;
    }
    if (amount > currentPlatformData.walletBalance) {
      showToast("Insufficient active wallet balance.");
      return;
    }
    if (!withdrawAddress.trim()) {
      showToast("Please enter your withdrawal wallet address.");
      return;
    }

    setIsSubmittingWithdraw(true);
    try {
      const token = localStorage.getItem('reviewer_auth_token');
      const res = await fetch(`${API_BASE}/transactions/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount, address: withdrawAddress, platform: activePlatform })
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Withdrawal request failed');
        return;
      }

      showToast(`Withdrawal request of $${amount.toFixed(2)} USD successfully queued.`);
      setIsWithdrawOpen(false);
      setWithdrawAmount('');
      setWithdrawAddress('');
      fetchAllData();
    } catch (err) {
      showToast('Server connection error. Failed to queue withdrawal.');
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  // Submit deposit request
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingDeposit) return;
    const amount = parseFloat(newDepositAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast("Please enter a valid deposit amount.");
      return;
    }
    if (!newDepositTxHash.trim()) {
      showToast("Please paste the transaction hash or TxID.");
      return;
    }
    const targetPlatform = enabledPlatform || 'Amazon';
    if (!isComboDeposit) {
      const minimumDeposit = targetPlatform === 'Amazon' ? 20 : targetPlatform === 'Alibaba' ? 299 : null;
      if (minimumDeposit !== null && amount < minimumDeposit) {
        showToast(`⚠️ Note: Entered amount is less than the standard $${minimumDeposit.toFixed(2)} minimum to unlock ${targetPlatform}. Request will be queued for review.`);
      }
    }

    setIsSubmittingDeposit(true);
    try {
      const token = localStorage.getItem('reviewer_auth_token');
      const res = await fetch(`${API_BASE}/transactions/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          platform: targetPlatform,
          protocol: selectedProtocol,
          amount: amount,
          txHash: newDepositTxHash,
          remark: newDepositRemark,
          currency: selectedProtocol === 'BTC' ? 'BTC' : 'USDT',
          cryptoAmount: amount
        })
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Deposit submission failed');
        return;
      }

      setNewDepositAmount('');
      setNewDepositTxHash('');
      setNewDepositRemark('');
      setIsComboDeposit(false);
      setComboDepositAmount(null);
      showToast(`Deposit request submitted! Awaiting audit verification by our review team.`);
      fetchAllData();
    } catch (err) {
      showToast('Server connection error. Failed to submit deposit.');
    } finally {
      setIsSubmittingDeposit(false);
    }
  };

  // Simulate deposit approval
  const handleSimulateApprove = async (id: string, amount: number) => {
    try {
      const token = localStorage.getItem('reviewer_auth_token');
      const res = await fetch(`${API_BASE}/transactions/override-approve-deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ depositId: id })
      });
      if (res.ok) {
        showToast(`Simulation: Deposit request approved and balance synced!`);
        fetchAllData();
      } else {
        showToast('Bypass approval failed.');
      }
    } catch (err) {
      showToast('Bypass connection error.');
    }
  };

  // Simulate deposit rejection
  const handleSimulateReject = async (id: string) => {
    try {
      const token = localStorage.getItem('reviewer_auth_token');
      const res = await fetch(`${API_BASE}/transactions/override-reject-deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ depositId: id })
      });
      if (res.ok) {
        showToast("Simulation: Deposit request rejected.");
        fetchAllData();
      }
    } catch (err) {
      showToast('Bypass rejection error.');
    }
  };

  // Reusable Network/Platform workspace selector bar (moved to header dropdown)
  const renderNetworkSelector = () => null;

  if (isDataLoading) {
    return (
      <div className="h-screen w-screen bg-[#F3F4F6] flex flex-col items-center justify-center font-sans text-gray-900">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 border-4 border-amazon-gold/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-amazon-gold border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div className="text-center">
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">amazon<span className="text-amazon-gold">Vine</span></h3>
            <p className="text-[10px] text-gray-400 font-sans mt-1">Initializing review dashboard secure session...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#F3F4F6] flex flex-col font-sans text-gray-900 overflow-hidden">

      {/* Sleek Top Header Dashboard Navbar */}
      <header className="bg-[#131921] text-white h-14 px-2 md:px-4 flex items-center justify-between sticky top-0 z-40 border-b border-gray-800">
        <div className="flex items-center space-x-1.5 md:space-x-3">
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1 md:p-1.5 rounded hover:bg-gray-800 transition focus:outline-none"
            aria-label="Toggle Sidebar"
          >
            <Menu className="h-4.5 w-4.5 md:h-5 md:w-5 text-gray-300 hover:text-white" />
          </button>

          <div className="flex items-center space-x-1 md:space-x-2 select-none">
            <div className="flex flex-col items-center pt-0.5">
              <div className="flex items-baseline text-white font-black text-sm italic tracking-tight font-sans">
                <span className="text-white text-base lowercase">amazon</span>
                <span className="text-amazon-gold text-[10px] uppercase font-extrabold ml-0.5 leading-none italic font-serif">Vine</span>
              </div>
              <svg className="h-1.5 w-14 -mt-1 text-amazon-gold" viewBox="0 0 100 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 2C30 12 70 12 95 2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M91 2L95 2L94 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Network & Active Wallet Info Dropdown */}
        <div className="flex items-center space-x-2 md:space-x-4">
          <div className="flex items-center space-x-1.5 md:space-x-2.5">
            {activePlatform && (
              <div className="bg-amazon-dark border border-gray-800 rounded px-1.5 py-0.5 md:px-3 md:py-1 text-left text-white relative">
                <p className="text-[7px] md:text-[8px] text-gray-400 font-bold uppercase tracking-wider leading-none">Network</p>
                {unlockedPlatforms.length > 1 ? (
                  <select
                    value={activePlatform}
                    onChange={(e) => handleSelectPlatform(e.target.value as any)}
                    className="text-xs font-black text-amazon-gold bg-transparent border-none outline-none cursor-pointer mt-0.5 leading-none pr-4 appearance-none select-none"
                    style={{ backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='gold' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right -4px center', backgroundSize: '16px' }}
                  >
                    {unlockedPlatforms.map((p) => (
                      <option key={p} value={p} className="bg-amazon-dark text-white">
                        {p}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs font-black text-amazon-gold mt-0.5 leading-none select-none">
                    {activePlatform}
                  </p>
                )}
              </div>
            )}

            <div className="bg-amazon-dark border border-gray-800 rounded px-1.5 py-0.5 md:px-3 md:py-1 text-right min-w-[55px] md:min-w-[70px]">
              <p className="text-[7px] md:text-[8px] text-gray-400 font-bold uppercase tracking-wider leading-none">Wallet</p>
              <p className="text-[10px] md:text-xs font-mono font-black text-green-500 mt-0.5 leading-none">
                ${currentPlatformData.walletBalance.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Notification bell dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-1.5 hover:bg-gray-800 text-gray-400 hover:text-white rounded-lg transition relative cursor-pointer"
              title="Notifications"
            >
              {notifications.some(n => n.status === 'unread') ? (
                <>
                  <BellRing className="h-4.5 w-4.5 text-amazon-gold animate-bounce" />
                  <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white rounded-full text-[8px] h-4 w-4 flex items-center justify-center font-black">
                    {notifications.filter(n => n.status === 'unread').length}
                  </span>
                </>
              ) : (
                <Bell className="h-4.5 w-4.5" />
              )}
            </button>

            {/* Notification Dropdown Container */}
            <AnimatePresence>
              {showNotifications && (
                <>
                  {/* Invisible backdrop to dismiss click outside */}
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />

                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2.5 w-80 bg-[#1a222d] border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden text-left"
                  >
                    <div className="p-4 bg-amazon-dark border-b border-gray-800 flex items-center justify-between">
                      <h3 className="text-xs font-black text-gray-200 uppercase tracking-wider">Evaluation Notifications</h3>
                      <div className="flex space-x-2 text-[9px] font-bold">
                        <button
                          onClick={markAllNotificationsRead}
                          className="text-amazon-gold hover:underline cursor-pointer"
                        >
                          Mark all read
                        </button>
                        <span className="text-gray-600">•</span>
                        <button
                          onClick={clearAllNotifications}
                          className="text-red-400 hover:underline cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="max-h-72 overflow-y-auto divide-y divide-gray-800/60">
                      {notifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => {
                            markNotificationRead(notif.id);
                            if (notif.type === 'deposit') {
                              setActiveTab('deposit');
                            } else if (notif.type === 'order') {
                              setActiveTab('orders');
                            } else if (notif.type === 'bonus') {
                              setActiveTab('invitation');
                            }
                            setShowNotifications(false);
                          }}
                          className={`p-3.5 hover:bg-gray-800/40 transition cursor-pointer flex items-start space-x-3 ${notif.status === 'unread' ? 'bg-gray-800/20' : ''
                            }`}
                        >
                          <span className={`mt-1 flex-shrink-0 h-2 w-2 rounded-full ${notif.type === 'deposit' ? 'bg-red-500' :
                            notif.type === 'order' ? 'bg-amber-500' :
                              'bg-green-500'
                            }`} />
                          <div className="flex-1 space-y-0.5">
                            <p className={`text-xs font-medium text-gray-200 ${notif.status === 'unread' ? 'font-black' : ''}`}>
                              {notif.text}
                            </p>
                            <p className="text-[10px] text-gray-500 font-mono">{notif.date}</p>
                          </div>
                          {notif.status === 'unread' && (
                            <span className="h-1.5 w-1.5 bg-amazon-gold rounded-full self-center" />
                          )}
                        </div>
                      ))}

                      {notifications.length === 0 && (
                        <div className="py-8 text-center text-xs text-gray-500">
                          No active notifications or logs found.
                        </div>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* User Profile photo */}
          <div className="flex items-center space-x-1 md:space-x-2 cursor-pointer" onClick={() => setActiveTab('profile')}>
            <div className="h-7.5 w-7.5 md:h-8 md:w-8 rounded-full overflow-hidden border border-gray-700 bg-gray-900 flex items-center justify-center shadow-inner cursor-pointer" title="Go to Profile Settings">
              {profile_photo ? (
                <img src={profile_photo} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <User className="h-4.5 w-4.5 text-gray-400" />
              )}
            </div>
            <button
              onClick={onLogout}
              className="p-1 md:p-1.5 hover:bg-gray-800 text-gray-400 hover:text-white rounded-lg transition"
              title="Logout"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>



      <div className="flex-1 flex overflow-hidden relative">

        {/* Sidebar Backdrop for Mobile view */}
        {!isSidebarCollapsed && (
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
            onClick={() => setIsSidebarCollapsed(true)}
          />
        )}

        {/* Left Collapsible Sidebar */}
        <aside
          className={`bg-[#131921] text-white border-r border-gray-800 transition-all duration-300 flex flex-col justify-between overflow-hidden fixed md:static inset-y-0 left-0 z-50 ${isSidebarCollapsed ? 'w-0 -translate-x-full md:w-16 md:translate-x-0 border-r-0 md:border-r' : 'w-64 translate-x-0'
            }`}
        >
          {/* Main Navigation Items */}
          <div className="py-4 flex-1 overflow-y-auto min-h-0 space-y-1 no-scrollbar">
            <div className="px-4 mb-4 select-none">
              {!isSidebarCollapsed && (
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Navigation Central</p>
              )}
            </div>

            <nav className="space-y-1.5 px-2">
              {/* Home */}
              <button
                onClick={() => handleTabSwitch('home')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${activeTab === 'home'
                  ? 'border border-amazon-gold text-[#F7CA00] bg-gray-850'
                  : 'border border-transparent text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <Home className="h-4 w-4 flex-shrink-0" />
                {!isSidebarCollapsed && <span>Home</span>}
              </button>

              {/* Deposit */}
              <button
                onClick={() => handleTabSwitch('deposit')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${activeTab === 'deposit'
                  ? 'border border-amazon-gold text-[#F7CA00] bg-gray-850'
                  : 'border border-transparent text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <Wallet className="h-4 w-4 flex-shrink-0" />
                {!isSidebarCollapsed && <span>Deposit</span>}
              </button>

              {/* Orders */}
              <button
                onClick={() => handleTabSwitch('orders')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${activeTab === 'orders'
                  ? 'border border-amazon-gold text-[#F7CA00] bg-gray-850'
                  : 'border border-transparent text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <FileText className="h-4 w-4 flex-shrink-0" />
                {!isSidebarCollapsed && <span>Orders</span>}
              </button>

              {/* Withdraw */}
              <button
                onClick={() => handleTabSwitch('withdraw')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${activeTab === 'withdraw'
                  ? 'border border-amazon-gold text-[#F7CA00] bg-gray-850'
                  : 'border border-transparent text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <ArrowUpRight className="h-4 w-4 flex-shrink-0" />
                {!isSidebarCollapsed && <span>Withdraw</span>}
              </button>

              {/* Profile */}
              <button
                onClick={() => handleTabSwitch('profile')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${activeTab === 'profile'
                  ? 'border border-amazon-gold text-[#F7CA00] bg-gray-850'
                  : 'border border-transparent text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <User className="h-4 w-4 flex-shrink-0" />
                {!isSidebarCollapsed && <span>Profile</span>}
              </button>

              {/* Invitation */}
              <button
                onClick={() => handleTabSwitch('invitation')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${activeTab === 'invitation'
                  ? 'border border-amazon-gold text-[#F7CA00] bg-gray-850'
                  : 'border border-transparent text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <Users className="h-4 w-4 flex-shrink-0" />
                {!isSidebarCollapsed && <span>Invitation</span>}
              </button>

              {/* Customer Service */}
              <button
                onClick={() => handleTabSwitch('customer-service')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${activeTab === 'customer-service'
                  ? 'border border-amazon-gold text-[#F7CA00] bg-gray-850'
                  : 'border border-transparent text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <MessageSquare className="h-4 w-4 flex-shrink-0" />
                {!isSidebarCollapsed && <span>Customer Service</span>}
              </button>

              {/* Terms */}
              <button
                onClick={() => handleTabSwitch('terms')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${activeTab === 'terms'
                  ? 'border border-amazon-gold text-[#F7CA00] bg-gray-850'
                  : 'border border-transparent text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <FileText className="h-4 w-4 flex-shrink-0" />
                {!isSidebarCollapsed && <span>Terms</span>}
              </button>

              {/* About Us */}
              <button
                onClick={() => handleTabSwitch('about-us')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${activeTab === 'about-us'
                  ? 'border border-amazon-gold text-[#F7CA00] bg-gray-850'
                  : 'border border-transparent text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <Info className="h-4 w-4 flex-shrink-0" />
                {!isSidebarCollapsed && <span>About Us</span>}
              </button>

              {/* FAQ */}
              <button
                onClick={() => handleTabSwitch('faq')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${activeTab === 'faq'
                  ? 'border border-amazon-gold text-[#F7CA00] bg-gray-850'
                  : 'border border-transparent text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <HelpCircle className="h-4 w-4 flex-shrink-0" />
                {!isSidebarCollapsed && <span>FAQ</span>}
              </button>
            </nav>
          </div>

          {/* Collapsible toggle & sign out bottom block */}
          <div className="p-3 border-t border-gray-800">
            <button
              onClick={onLogout}
              className={`w-full flex items-center space-x-3 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-950/30 hover:text-red-300 rounded-lg transition-all text-left ${isSidebarCollapsed ? 'justify-center' : ''
                }`}
            >
              <LogOut className="h-4 w-4 flex-shrink-0" />
              {!isSidebarCollapsed && <span>Sign Out</span>}
            </button>
          </div>
        </aside>

        {/* Main Content Dashboard Frame */}
        <main className="flex-1 p-3 md:p-8 pb-20 md:pb-8 overflow-y-auto max-w-7xl mx-auto w-full flex flex-col justify-between">

          {/* Tab Content Router */}
          <div className="flex-1 space-y-6">
            {/* ================================== OVERVIEW ================================== */}
            {activeTab === 'home' && (
              <div className="space-y-6 animate-fadeIn text-left">
                {/* Active Network Indicator Banner */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between shadow-xs">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-amazon-orange/10 text-amazon-orange rounded-full flex items-center justify-center font-bold">
                      <Globe className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Your Assigned Work Network</p>
                      <h4 className="text-sm font-black text-gray-900 mt-0.5">
                        {enabledPlatform ? (
                          <span>
                            {enabledPlatform} (VIP {enabledPlatform === 'Amazon' ? '1' : enabledPlatform === 'Alibaba' ? '2' : '3'})
                          </span>
                        ) : (
                          <span className="text-gray-450 italic font-medium">Pending active network assignment by administrator</span>
                        )}
                      </h4>
                    </div>
                  </div>
                  <div>
                    {enabledPlatform ? (
                      <span className="bg-green-50 text-green-700 text-[10px] font-black uppercase px-3 py-1 rounded-full border border-green-200 animate-pulse font-sans">
                        ● Active Network
                      </span>
                    ) : (
                      <span className="bg-amber-50 text-amber-700 text-[10px] font-black uppercase px-3 py-1 rounded-full border border-amber-200 font-sans">
                        Activation Pending
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-6 animate-fadeIn">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                    {/* Card 1: Total Balance */}
                    <div className="bg-white p-3 md:p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
                      <div>
                        <p className="text-[9px] md:text-xxs text-gray-400 uppercase font-black tracking-wider">Available Balance</p>
                        <h3 className="text-lg md:text-2xl font-mono font-black text-green-600 mt-0.5 md:mt-1">${currentPlatformData.walletBalance.toFixed(2)}</h3>
                      </div>
                      <p className="text-[9px] md:text-[10px] text-gray-500 mt-2 md:mt-4 border-t border-gray-100 pt-2 font-mono">
                        USDT Address ready
                      </p>
                    </div>

                    {/* Card 2: Completed Orders */}
                    <div className="bg-white p-3 md:p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
                      <div>
                        <p className="text-[9px] md:text-xxs text-gray-400 uppercase font-black tracking-wider">Completed Orders</p>
                        <h3 className="text-lg md:text-2xl font-mono font-black text-gray-900 mt-0.5 md:mt-1">{currentPlatformData.completedOrders}</h3>
                      </div>
                      <p className="text-[9px] md:text-[10px] text-gray-500 mt-2 md:mt-4 border-t border-gray-100 pt-2 font-semibold truncate" title={assignedProducts.length > 0 && (assignedProducts.length - currentPlatformData.completedOrders) > 0 ? `${assignedProducts.length - currentPlatformData.completedOrders} remaining` : (assignedProducts.length > 0 ? "✓ Unlocked!" : "No products assigned")}>
                        {assignedProducts.length > 0 && (assignedProducts.length - currentPlatformData.completedOrders) > 0
                          ? `${assignedProducts.length - currentPlatformData.completedOrders} remaining`
                          : (assignedProducts.length > 0 ? "✓ Unlocked!" : "No products assigned")}
                      </p>
                    </div>

                    {/* Card 3: Pending Reviews */}
                    <div className="bg-white p-3 md:p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
                      <div>
                        <p className="text-[9px] md:text-xxs text-gray-400 uppercase font-black tracking-wider">Pending Verification</p>
                        <h3 className="text-lg md:text-2xl font-mono font-black text-amber-500 mt-0.5 md:mt-1">{currentPlatformData.pendingReviews}</h3>
                      </div>
                      <p className="text-[9px] md:text-[10px] text-gray-500 mt-2 md:mt-4 border-t border-gray-100 pt-2 truncate">
                        Awaiting approval
                      </p>
                    </div>

                    {/* Card 4: Profit Earned */}
                    <div className="bg-white p-3 md:p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
                      <div>
                        <p className="text-[9px] md:text-xxs text-gray-400 uppercase font-black tracking-wider">Total Profit Earned</p>
                        <h3 className="text-lg md:text-2xl font-mono font-black text-amazon-blue mt-0.5 md:mt-1">${currentPlatformData.profitEarned.toFixed(2)}</h3>
                      </div>
                      <p className="text-[9px] md:text-[10px] text-gray-500 mt-2 md:mt-4 border-t border-gray-100 pt-2 truncate">
                        Cumulative payout
                      </p>
                    </div>

                    {/* Card 5: Invitation */}
                    <div className="bg-white p-3 md:p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
                      <div>
                        <p className="text-[9px] md:text-xxs text-gray-400 uppercase font-black tracking-wider">Invitation</p>
                        <h3 className="text-lg md:text-2xl font-mono font-black text-purple-600 mt-0.5 md:mt-1">0</h3>
                      </div>
                      <p className="text-[9px] md:text-[10px] text-gray-500 mt-2 md:mt-4 border-t border-gray-100 pt-2 truncate">
                        {referralCode ? `Code: ${referralCode}` : 'Share your code'}
                      </p>
                    </div>

                    {/* Card 6: Withdraw */}
                    <div className="bg-white p-3 md:p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
                      <div>
                        <p className="text-[9px] md:text-xxs text-gray-400 uppercase font-black tracking-wider">Withdraw</p>
                        <h3 className="text-lg md:text-2xl font-mono font-black text-cyan-600 mt-0.5 md:mt-1">${withdrawals.filter((w: any) => w.status === 'Approved').reduce((sum: number, w: any) => sum + parseFloat(w.amount || 0), 0).toFixed(2)}</h3>
                      </div>
                      <p className="text-[9px] md:text-[10px] text-gray-500 mt-2 md:mt-4 border-t border-gray-100 pt-2 truncate">
                        {withdrawals.length > 0 ? `${withdrawals.length} request${withdrawals.length > 1 ? 's' : ''} made` : 'No withdrawals yet'}
                      </p>
                    </div>
                  </div>

                  {/* Withdrawal progress section */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs text-left space-y-4">
                    {/* Dynamic Progress Bar Block */}
                    {(() => {
                      const completedCount = currentPlatformData.completedOrders;
                      const targetCount = assignedProducts.length || 25;
                      const progressPercentage = targetCount > 0 ? Math.min(100, Math.round((completedCount / targetCount) * 100)) : 0;
                      const remainingReviews = Math.max(0, targetCount - completedCount);

                      return (
                        <div className="space-y-3.5">
                          <div className="flex justify-between items-baseline text-xs">
                            <span className="font-bold text-gray-800">Compliance Threshold Progress</span>
                            <span className="font-mono font-black text-amazon-orange">{completedCount}/{targetCount} ({progressPercentage}%)</span>
                          </div>

                          {/* Modern Visual Progress Bar */}
                          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-amazon-gold to-amazon-orange h-full transition-all duration-300"
                              style={{ width: `${progressPercentage}%` }}
                            />
                          </div>

                          <div className="flex items-start space-x-2 text-xs">
                            <Info className="h-4 w-4 mt-0.5 text-amazon-orange flex-shrink-0" />
                            <p className="text-gray-600">
                              {remainingReviews > 0 ? (
                                <span>
                                  Complete <strong className="text-amazon-orange font-bold font-mono">{remainingReviews} more reviews</strong> to unlock balance withdrawal capabilities for the active <strong className="font-bold">{activePlatform}</strong> workspace.
                                </span>
                              ) : (
                                <span className="text-green-600 font-bold">
                                  ✓ Minimum compliance threshold reached! Withdrawal authorization is now unlocked.
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Main section greeting */}
                  <div className="bg-gradient-to-r from-amazon-navy to-amazon-dark text-white rounded-xl p-6 shadow-sm border border-gray-800">
                    <h2 className="text-lg font-black text-white">Welcome back to the Evaluation Workspace, {username}!</h2>
                    <p className="text-xs text-gray-300 mt-1.5 leading-relaxed max-w-3xl">
                      Sellers utilize this dashboard to verify purchase compliance and payout legitimate micro-commissions. Please head over to the <strong>Assigned Gigs</strong> tab to begin compliance steps. All rewards range between <strong>$0.50 and $2.50 max</strong> per product.
                    </p>
                  </div>
                </div>

                {/* Available Evaluation Campaigns Pool Slider */}
                <div className="space-y-3.5 pt-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Available Campaigns Pool</h3>
                      <p className="text-[10px] text-gray-400 font-sans">Live dynamic campaign feeds updated in real-time.</p>
                    </div>
                    <span className="text-[9px] font-black uppercase text-green-600 bg-green-50 px-2 py-0.5 border border-green-200 rounded-full animate-pulse">Live Feeds</span>
                  </div>

                  <div className="relative group">
                    {showLeftArrow && (
                      <button
                        type="button"
                        onClick={() => scrollSlider('left')}
                        className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 h-7 w-7 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-gray-800 hover:bg-gray-50 transition font-black text-base cursor-pointer focus:outline-none"
                      >
                        ‹
                      </button>
                    )}

                    <div
                      ref={sliderRef}
                      onScroll={handleScroll}
                      className="flex space-x-4 overflow-x-auto scrollbar-none pb-2 select-none"
                    >
                      {shuffledCampaigns.slice(0, 15).map((prod) => (
                        <div
                          key={prod.id}
                          className="flex-shrink-0 w-52 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col justify-between shadow-xxs hover:shadow-xs transition p-4 space-y-3.5"
                        >
                          <div className="h-36 w-full flex items-center justify-center bg-gray-50/50 rounded-lg p-2 overflow-hidden">
                            <img src={prod.image} alt={prod.title} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-gray-655 truncate leading-snug" title={prod.title}>{prod.title}</h4>
                            <div className="flex justify-between items-baseline pt-1">
                              <div className="flex flex-col text-left">
                                <span className="text-[9px] text-gray-400 font-extrabold uppercase leading-none">Price</span>
                                <span className="text-sm font-mono font-bold text-gray-800 mt-0.5">${parseFloat(prod.price || 0).toFixed(2)}</span>
                              </div>
                              <div className="flex flex-col text-right">
                                <span className="text-[9px] text-gray-400 font-extrabold uppercase leading-none">Payout</span>
                                <span className="text-sm font-mono font-black text-green-600 mt-0.5">+${parseFloat(prod.payout || 0).toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {showRightArrow && (
                      <button
                        type="button"
                        onClick={() => scrollSlider('right')}
                        className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 h-7 w-7 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-gray-800 hover:bg-gray-50 transition font-black text-base cursor-pointer focus:outline-none"
                      >
                        ›
                      </button>
                    )}
                  </div>
                </div>

                {/* Real-time Amazon Product Search Engine */}
                <div className="max-w-4xl mx-auto px-1 md:px-0 pt-6 mt-8 border-t border-gray-150">
                  <div className="bg-white rounded-2xl p-5 md:p-8 text-gray-900 border border-gray-200 relative overflow-hidden shadow-sm">
                    {/* Background Watermarks */}
                    <div className="absolute top-0 right-0 opacity-[0.03] pointer-events-none transform translate-x-12 -translate-y-12">
                      <Search className="w-64 h-64 text-gray-900" />
                    </div>
                    <div className="absolute bottom-0 left-0 opacity-[0.03] pointer-events-none transform -translate-x-12 translate-y-12">
                      <Globe className="w-64 h-64 text-gray-900" />
                    </div>
                    
                    <div className="relative z-10 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-3">
                        <div className="space-y-1 text-left">
                          <div className="flex items-center space-x-2">
                            <span className="bg-[#ff9900] text-black text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-sm">
                              Live Engine
                            </span>
                            <h3 className="text-base md:text-lg font-black tracking-tight text-gray-900 uppercase">
                              Real-Time Amazon Search
                            </h3>
                          </div>
                          <p className="text-[11px] md:text-xs text-gray-555 font-sans font-medium">
                            Search products directly from Amazon.com to view live pricing and images.
                          </p>
                        </div>
                        <div className="flex items-center opacity-85 self-start sm:self-center">
                          <img
                            src="/amazon-logo.svg"
                            alt="Amazon Logo"
                            className="h-4.5 md:h-5 w-auto object-contain"
                          />
                        </div>
                      </div>

                      <form onSubmit={handleAmazonSearch} className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                          <input
                            type="text"
                            value={amazonSearchQuery}
                            onChange={(e) => setAmazonSearchQuery(e.target.value)}
                            placeholder="Enter keyword (e.g. Hairdryer, Wireless Earbuds, Sneaker)..."
                            className="w-full bg-gray-50 border border-gray-250 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-[#ff9900] transition-all"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={amazonSearchLoading}
                          className="bg-[#ff9900] text-black font-bold text-xs px-6 py-2.5 rounded-xl hover:bg-amber-500 hover:shadow-xs transition-all shadow-xxs flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50"
                        >
                          {amazonSearchLoading ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4.5 w-4.5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span>Searching...</span>
                            </>
                          ) : (
                            <span>Search</span>
                          )}
                        </button>
                      </form>

                      {amazonSearchError && (
                        <p className="text-xxs font-semibold text-red-500 mt-1 font-sans text-left">
                          {amazonSearchError}
                        </p>
                      )}

                      {amazonSearchResults.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-4 border-t border-gray-100 animate-fadeIn">
                          {amazonSearchResults.map((item, idx) => (
                            <a
                              key={idx}
                              href={item.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group bg-gray-50/50 hover:bg-white border border-gray-200 hover:border-[#ff9900]/50 rounded-xl p-2.5 transition-all flex flex-col h-full text-left shadow-xxs hover:shadow-xs"
                            >
                              <div className="aspect-square bg-white rounded-lg overflow-hidden flex items-center justify-center relative p-1.5 mb-2 border border-gray-100 group-hover:scale-95 transition-transform duration-300">
                                <img
                                  src={item.imageUrl}
                                  alt={item.title}
                                  className="max-h-full max-w-full object-contain"
                                  onError={(e) => {
                                    e.currentTarget.src = "https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=500";
                                  }}
                                />
                                <span className="absolute bottom-1 right-1 bg-black/75 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-sm backdrop-blur-xs font-mono">
                                  ASIN: {item.asin}
                                </span>
                              </div>
                              <div className="flex-1 flex flex-col justify-between space-y-1">
                                <h4 className="text-[10px] md:text-[11px] font-bold text-gray-700 line-clamp-2 leading-tight group-hover:text-[#ff9900] transition-colors">
                                  {item.title}
                                </h4>
                                <div className="flex items-center justify-between pt-1">
                                  <span className="text-xs md:text-sm font-black text-gray-950 font-mono">
                                    ${item.price.toFixed(2)}
                                  </span>
                                  <span className="text-[8px] font-bold text-[#ff9900] opacity-0 group-hover:opacity-100 transform translate-x-1 group-hover:translate-x-0 transition-all flex items-center space-x-0.5">
                                    <span>View</span>
                                    <ArrowUpRight className="h-2.5 w-2.5" />
                                  </span>
                                </div>
                              </div>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* WFP Organization Support Card */}
                <div className="max-w-4xl mx-auto px-1 md:px-0 mt-4 mb-4 pb-4">
                  <a
                    href="https://www.wfp.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col sm:flex-row items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-100 rounded-2xl p-4 transition-all duration-300 shadow-xxs hover:shadow-xs"
                  >
                    <div className="flex items-center space-x-3.5 text-left font-sans">
                      <div className="bg-blue-600 text-white p-2.5 rounded-xl group-hover:scale-110 transition-transform">
                        <Globe className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                          <span>World Food Programme</span>
                          <span className="bg-blue-200 text-blue-800 text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase">
                            Official Partner
                          </span>
                        </h4>
                        <p className="text-[10px] text-blue-700 font-medium font-sans mt-0.5 leading-relaxed">
                          Reviewers Hub proudly supports the UN World Food Programme (WFP) in fighting global hunger. Click to learn more about the cause.
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 sm:mt-0 bg-blue-600 group-hover:bg-blue-700 text-white font-bold text-xxs px-4 py-2 rounded-lg transition-colors flex items-center space-x-1 whitespace-nowrap self-end sm:self-center font-sans">
                      <span>Visit WFP.org</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </div>
                  </a>
                </div>

              </div>
            )}

            {/* ================================== DEPOSIT ================================== */}
            {activeTab === 'deposit' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <div className="max-w-2xl">
                  <h2 className="text-lg font-black text-gray-900">Deposit Collateral Funds</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Add funds to your account to participate in review tasks. Submit a deposit request and complete payment to credit your balance.
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start space-x-3 text-amber-800 max-w-3xl">
                  <ShieldAlert className="h-5 w-5 flex-shrink-0 mt-0.5 text-amber-600" />
                  <div className="text-xs leading-relaxed font-medium">
                    <strong className="text-amber-900 font-bold">Important Notice:</strong>
                    <p className="mt-0.5 text-amber-700">
                      Transfer only supported tokens. Sending unsupported currency or using incorrect protocols results in permanent loss of funds.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left part: New Deposit form */}
                  <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 p-6 space-y-6 shadow-xs">
                    <div>
                      <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide font-sans">New Deposit Request</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Select a protocol below and transfer crypto assets.</p>
                    </div>

                    {/* Protocol selector */}
                    <div className="space-y-3">
                      <label className="text-[10px] text-gray-400 uppercase font-black">Select Protocol to Use</label>
                      <div className="grid grid-cols-3 gap-3">
                        {([
                          {
                            key: 'TRC-20',
                            label: 'TRC-20',
                            coin: 'USDT (Tron)',
                            logo: (
                              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="12" fill="#26A17B" />
                                <path d="M12.7 8.3v1.8h3.9v3h-3.9v5H9.7v-5H5.8v-3h3.9V8.3c-2.4-.2-4.1-.7-4.1-1.3 0-.6 1.7-1.1 4.1-1.3v-1.1h3v1.1c2.4.2 4.1.7 4.1 1.3 0 .6-1.7 1.1-4.1 1.3zm.0-3.3c-1.8-.1-3.6-.1-5.4 0 .9.2 2.7.3 3.6.3s2.7-.1 3.6-.3z" fill="white" />
                              </svg>
                            )
                          },
                          {
                            key: 'ERC-20',
                            label: 'ERC-20',
                            coin: 'USDT (Ethereum)',
                            logo: (
                              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="12" fill="#627EEA" />
                                <path d="M12 3L6 12.8l6 3.6 6-3.6L12 3zm0 14l-6-3.6 6 8.6 6-8.6-6 3.6z" fill="white" fillOpacity="0.9" />
                                <path d="M12 3v13.4l6-3.6L12 3zm0 14v8.6l6-8.6-6-3.6z" fill="white" fillOpacity="0.5" />
                              </svg>
                            )
                          },
                          {
                            key: 'BTC',
                            label: 'BTC',
                            coin: 'BTC (Bitcoin)',
                            logo: (
                              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="12" fill="#F7931A" />
                                <path d="M16.1 10.3c.2-.9-.3-1.5-1.3-1.8l.6-2.5-1.5-.4-.6 2.4c-.4-.1-.8-.2-1.2-.3l.6-2.4-1.5-.4-.6 2.5c-.3-.1-.7-.2-1-.2l.0-.0-2.1-.5-.4 1.6s1.1.3 1.1.3c.6.2.7.5.7.8l-.7 2.8c.0.0.1.1.1.1l.0.0c-.1-.1-.1-.1-.1-.1l-.7 2.8c-.1.3-.3.5-.8.4 0 0-1.1-.3-1.1-.3l-.7 1.7 2.0.5c.4.1.7.2 1.1.2l-.6 2.5 1.5.4.6-2.4c.4.1.8.2 1.2.2l-.6 2.5 1.5.4.6-2.5c2.4.5 4.3.3 5.0-1.9.6-1.8-.1-2.8-1.4-3.5 1.0-.2 1.7-.8 1.9-2.0zm-3.4 5.3c-.4 1.7-3.2.8-4.2.5l.8-3.4c.9.2 3.8.7 3.4 2.9zm.4-5.3c-.4 1.6-2.7.8-3.6.5l.8-3.1c.8.2 3.2.7 2.8 2.6z" fill="white" />
                              </svg>
                            )
                          }
                        ]).map((proto) => (
                          <button
                            key={proto.key}
                            onClick={() => setSelectedProtocol(proto.key)}
                            className={`p-3 rounded-lg border text-left transition flex flex-col justify-between h-24 cursor-pointer ${selectedProtocol === proto.key
                              ? 'border-amazon-gold bg-amber-50/30 text-gray-900 ring-1 ring-amazon-gold shadow-xs'
                              : 'border-gray-200 hover:border-gray-300 text-gray-600 bg-white'
                              }`}
                          >
                            {proto.logo}
                            <div className="mt-1.5">
                              <p className="text-xs font-black leading-none">{proto.label}</p>
                              <p className="text-[9px] text-gray-400 mt-0.5">{proto.coin}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Address box */}
                    <div className="space-y-2.5 bg-gray-50 p-4.5 rounded-xl border border-gray-200">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] text-gray-500 uppercase font-bold">
                          {selectedProtocol === 'BTC' ? 'BTC' : 'USDT'} Deposit Address
                        </label>
                        <span className="text-[9px] text-green-600 font-mono font-black">Online & Ready</span>
                      </div>
                      <div className="flex bg-white border border-gray-300 rounded-lg overflow-hidden">
                        <input
                          type="text"
                          readOnly
                          value={depositAddresses[selectedProtocol] || ''}
                          className="flex-1 px-3 py-2.5 text-xs font-mono bg-transparent text-gray-800 select-all focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            handleCopyText(depositAddresses[selectedProtocol] || '', "Deposit Address");
                          }}
                          className="px-4 bg-[#131921] hover:bg-black text-white text-xs font-bold flex items-center space-x-1 cursor-pointer transition-colors"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy</span>
                        </button>
                      </div>
                      <p className="text-[9px] text-gray-400 font-medium">
                        Send only {selectedProtocol === 'BTC' ? 'BTC' : 'USDT'} assets to this protocol address. Blockchain validation requires 2 confirmations.
                      </p>
                    </div>

                    {/* Deposit details form inputs */}
                    <form onSubmit={handleDepositSubmit} className="space-y-4">
                      {/* Special Combo Payment lock alert banner */}
                      {isComboDeposit && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3 text-red-800 animate-fadeIn">
                          <ShieldAlert className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-600" />
                          <div className="text-xs leading-relaxed font-medium">
                            <strong className="text-red-900 font-bold">Special Combo Deposit Lock Active</strong>
                            <p className="mt-0.5 text-red-700">
                              {selectedProtocol === 'BTC'
                                ? <>Deposit approximately <strong className="font-mono">${comboDepositAmount || newDepositAmount}</strong> USD worth of BTC to satisfy the micro-campaign criteria. Enter the BTC amount matching this USD value.</>
                                : <>You are executing a locked deposit request of <strong className="font-mono">${newDepositAmount}</strong> to satisfy the micro-campaign criteria. This field is locked.</>
                              }
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-505 uppercase font-black">
                            Amount ({selectedProtocol === 'BTC' ? 'BTC' : 'USDT'})
                            {isComboDeposit && selectedProtocol !== 'BTC' && <span className="text-red-600 font-bold ml-1.5">(Locked)</span>}
                            {isComboDeposit && selectedProtocol === 'BTC' && <span className="text-amber-600 font-bold ml-1.5">(≈${comboDepositAmount || newDepositAmount} USD)</span>}
                          </label>
                          <input
                            type="number"
                            step="any"
                            required
                            disabled={isComboDeposit && selectedProtocol !== 'BTC'}
                            readOnly={isComboDeposit && selectedProtocol !== 'BTC'}
                            placeholder={isComboDeposit && selectedProtocol === 'BTC' ? `e.g. ${(parseFloat(comboDepositAmount || newDepositAmount || '10') / 70000).toFixed(6)}` : "Enter amount (e.g. 20.00)"}
                            value={newDepositAmount}
                            onChange={(e) => setNewDepositAmount(e.target.value)}
                            className={`w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold font-medium text-gray-800 ${isComboDeposit && selectedProtocol !== 'BTC' ? 'bg-gray-100 cursor-not-allowed opacity-80' : ''}
                              }`}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-505 uppercase font-black font-sans">Transaction Hash / TxID</label>
                          <input
                            type="text"
                            required
                            placeholder="Paste transaction hash or TxID"
                            value={newDepositTxHash}
                            onChange={(e) => setNewDepositTxHash(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold font-medium text-gray-800"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-505 uppercase font-black">
                          {isComboDeposit ? 'Combo Payment Identifier (Locked)' : 'Remark (optional)'}
                        </label>
                        <input
                          type="text"
                          placeholder={isComboDeposit ? "Auto-assigned combo identifier" : "Add a note or sender wallet details..."}
                          value={newDepositRemark}
                          onChange={(e) => setNewDepositRemark(e.target.value)}
                          disabled={isComboDeposit}
                          className={`w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold font-medium text-gray-800 ${isComboDeposit ? 'bg-gray-100 cursor-not-allowed opacity-80' : ''}`}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmittingDeposit}
                        className="w-full py-3 bg-amazon-gold hover:bg-[#e2b600] disabled:bg-gray-200 text-amazon-dark disabled:text-gray-400 font-black text-xs rounded-lg transition-colors cursor-pointer text-center disabled:cursor-not-allowed"
                      >
                        {isSubmittingDeposit ? (
                          <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Submitting...
                          </span>
                        ) : (
                          'Submit deposit'
                        )}
                      </button>
                    </form>
                  </div>

                  {/* Right part: Recent Deposit Requests history with simulation approval triggers */}
                  <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col space-y-4">
                    <div>
                      <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">Recent deposit requests</h3>
                      <p className="text-xs text-gray-400 mt-0.5 font-sans">Check and validate your pending crypto transfers.</p>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3.5 pt-2">
                      {depositRequests.map((req) => (
                        <div key={req.id} className="border border-gray-150 p-4.5 rounded-xl bg-gray-50/50 space-y-3 text-xs">
                          <div className="flex justify-between items-center border-b border-gray-150 pb-2">
                            <span className="font-bold text-gray-855">{req.protocol} Network</span>
                            <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded border ${req.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-200 font-bold' :
                              req.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200 font-bold' :
                                'bg-amber-50 text-amber-700 border-amber-200 animate-pulse font-bold'
                              }`}>
                              {req.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-y-1.5 text-gray-600 font-medium">
                            <div>Amount:</div>
                            <div className="text-right font-black font-mono text-gray-900">{'$' + req.amount.toFixed(2) + ' ' + (req.currency || (req.protocol === 'BTC' ? 'BTC' : 'USDT'))}</div>
                            <div>Hash:</div>
                            <div className="text-right font-mono text-[10px] text-gray-400 truncate max-w-[120px] ml-auto cursor-pointer" title={req.txHash}>
                              {req.txHash.length > 12 ? `${req.txHash.slice(0, 6)}...${req.txHash.slice(-6)}` : req.txHash}
                            </div>
                            {req.remark && (
                              <>
                                <div>Remark:</div>
                                <div className="text-right italic truncate max-w-[120px] ml-auto">{req.remark}</div>
                              </>
                            )}
                            <div>Date:</div>
                            <div className="text-right font-mono text-gray-500">{req.date}</div>
                          </div>
                        </div>
                      ))}

                      {depositRequests.length === 0 && (
                        <div className="text-center py-12 text-gray-400">
                          <Wallet className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                          <p className="font-bold">No deposit requests yet.</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">Submit a deposit above to see it here.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================================== ORDERS (EVALUATIONS) ================================== */}
            {activeTab === 'orders' && (
              <div className="space-y-3 md:space-y-6 animate-fadeIn text-left">
                {selectedOrderCategory === null ? (
                  /* Platform selection screen */
                  <div className="space-y-3 md:space-y-6 animate-fadeIn">
                    <div className="text-center max-w-xl mx-auto space-y-0.5 md:space-y-2 py-1.5 md:py-4">
                      <h2 className="text-sm md:text-xl font-black text-gray-900 tracking-tight uppercase">Select Platform Network</h2>
                      <p className="text-[10px] md:text-xs text-gray-550 font-sans">
                        Please select your assigned VIP category to view and perform order evaluations.
                      </p>
                    </div>

                    <div className="flex flex-col md:grid md:grid-cols-3 gap-2 md:gap-6 max-w-4xl mx-auto px-1 md:px-0">
                      {/* VIP 1: Amazon */}
                      <button
                        onClick={() => {
                          setSelectedOrderCategory('Amazon');
                          if (enabledPlatform === 'Amazon') {
                            handleSelectPlatform('Amazon');
                          }
                        }}
                        className="relative overflow-hidden bg-white rounded-xl md:rounded-2xl border border-gray-200 p-2 md:p-6 hover:border-amazon-orange hover:shadow-md transition-all cursor-pointer group flex flex-col items-center justify-between min-h-[80px] md:min-h-[240px] w-full pt-3 pb-1.5 md:pt-6 md:pb-6"
                      >
                        <span className="absolute top-0 left-0 bg-amazon-orange text-white text-[7px] md:text-[9px] font-black uppercase px-2 py-0.5 md:px-2.5 md:py-1 rounded-tl-xl md:rounded-tl-2xl rounded-br-lg shadow-xxs">
                          VIP 1
                        </span>
                        <div className="h-5 md:h-14 w-full flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0 mt-0.5 md:mt-0">
                          <img
                            src="/amazon-logo.svg"
                            alt="Amazon"
                            className="h-4.5 md:h-8 w-auto object-contain"
                          />
                        </div>
                        <div className="flex-1 flex flex-col items-center px-1 md:px-0 min-w-0 mt-0.5 md:mt-2">
                          <div className="flex items-center space-x-1.5 justify-center">
                            <h3 className="font-black text-gray-900 uppercase text-[9px] sm:text-xs md:text-sm">Amazon</h3>
                            <span className="inline-block bg-orange-50 text-amazon-orange text-[7px] sm:text-[9px] md:text-[10px] font-black uppercase px-1 py-0.5 rounded border border-orange-100 flex-shrink-0">
                              4% Comm.
                            </span>
                          </div>
                          <span className="text-[8px] md:text-[10px] font-bold text-gray-500 mt-0.5 font-mono">
                            Min. Balance: $20
                          </span>
                        </div>
                        <p className="text-xxs text-gray-555 font-sans hidden sm:block">
                          Standard e-commerce workspace for beginner tier reviewers.
                        </p>
                        <div className="text-[8px] md:text-xs font-black text-amazon-orange flex items-center space-x-1 flex-shrink-0 mt-0.5 md:mt-0">
                          <span>Enter Panel</span>
                          <ArrowRight className="h-2 w-2 md:h-3 md:w-3 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </button>

                      {/* VIP 2: Alibaba */}
                      <button
                        onClick={() => {
                          setSelectedOrderCategory('Alibaba');
                          if (enabledPlatform === 'Alibaba') {
                            handleSelectPlatform('Alibaba');
                          }
                        }}
                        className="relative overflow-hidden bg-white rounded-xl md:rounded-2xl border border-gray-200 p-2 md:p-6 hover:border-blue-600 hover:shadow-md transition-all cursor-pointer group flex flex-col items-center justify-between min-h-[80px] md:min-h-[240px] w-full pt-3 pb-1.5 md:pt-6 md:pb-6"
                      >
                        <span className="absolute top-0 left-0 bg-blue-600 text-white text-[7px] md:text-[9px] font-black uppercase px-2 py-0.5 md:px-2.5 md:py-1 rounded-tl-xl md:rounded-tl-2xl rounded-br-lg shadow-xxs">
                          VIP 2
                        </span>
                        <div className="h-5 md:h-14 w-full flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0 mt-0.5 md:mt-0">
                          <img
                            src="/alibaba-logo.svg"
                            alt="Alibaba"
                            className="h-4.5 md:h-10 w-auto object-contain"
                          />
                        </div>
                        <div className="flex-1 flex flex-col items-center px-1 md:px-0 min-w-0 mt-0.5 md:mt-2">
                          <div className="flex items-center space-x-1.5 justify-center">
                            <h3 className="font-black text-gray-900 uppercase text-[9px] sm:text-xs md:text-sm">Alibaba</h3>
                            <span className="inline-block bg-blue-50 text-blue-600 text-[7px] sm:text-[9px] md:text-[10px] font-black uppercase px-1 py-0.5 rounded border border-blue-100 flex-shrink-0">
                              8% Comm.
                            </span>
                          </div>
                          <span className="text-[8px] md:text-[10px] font-bold text-gray-500 mt-0.5 font-mono">
                            Min. Balance: $299
                          </span>
                        </div>
                        <p className="text-xxs text-gray-555 font-sans hidden sm:block">
                          Advanced wholesale workspace with higher micro-commissions.
                        </p>
                        <div className="text-[8px] md:text-xs font-black text-blue-600 flex items-center space-x-1 flex-shrink-0 mt-0.5 md:mt-0">
                          <span>Enter Panel</span>
                          <ArrowRight className="h-2 w-2 md:h-3 md:w-3 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </button>

                      {/* VIP 3: Shopify */}
                      <button
                        onClick={() => {
                          setSelectedOrderCategory('Shopify');
                          if (enabledPlatform === 'Shopify') {
                            handleSelectPlatform('Shopify');
                          }
                        }}
                        className="relative overflow-hidden bg-white rounded-xl md:rounded-2xl border border-gray-200 p-2 md:p-6 hover:border-green-600 hover:shadow-md transition-all cursor-pointer group flex flex-col items-center justify-between min-h-[80px] md:min-h-[240px] w-full pt-3 pb-1.5 md:pt-6 md:pb-6"
                      >
                        <span className="absolute top-0 left-0 bg-green-600 text-white text-[7px] md:text-[9px] font-black uppercase px-2 py-0.5 md:px-2.5 md:py-1 rounded-tl-xl md:rounded-tl-2xl rounded-br-lg shadow-xxs">
                          VIP 3
                        </span>
                        <div className="h-5 md:h-14 w-full flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0 mt-0.5 md:mt-0">
                          <img
                            src="/shopify-logo.svg"
                            alt="Shopify"
                            className="h-4.5 md:h-10 w-auto object-contain"
                          />
                        </div>
                        <div className="flex-1 flex flex-col items-center px-1 md:px-0 min-w-0 mt-0.5 md:mt-2">
                          <div className="flex items-center space-x-1.5 justify-center">
                            <h3 className="font-black text-gray-900 uppercase text-[9px] sm:text-xs md:text-sm">Shopify</h3>
                            <span className="inline-block bg-green-50 text-green-700 text-[7px] sm:text-[9px] md:text-[10px] font-black uppercase px-1 py-0.5 rounded border border-green-100 flex-shrink-0">
                              12% Comm.
                            </span>
                          </div>
                          <span className="text-[8px] md:text-[10px] font-bold text-gray-500 mt-0.5 font-mono">
                            Min. Balance: $499
                          </span>
                        </div>
                        <p className="text-xxs text-gray-555 font-sans hidden sm:block">
                          Premium storefront evaluations with maximum reward multiplier.
                        </p>
                        <div className="text-[8px] md:text-xs font-black text-green-600 flex items-center space-x-1 flex-shrink-0 mt-0.5 md:mt-0">
                          <span>Enter Panel</span>
                          <ArrowRight className="h-2 w-2 md:h-3 md:w-3 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </button>
                    </div>

                    {/* Real-time Amazon Product Search Engine */}
                    <div className="max-w-4xl mx-auto px-1 md:px-0 pt-6 mt-8 border-t border-gray-150">
                      <div className="bg-white rounded-2xl p-5 md:p-8 text-gray-900 border border-gray-200 relative overflow-hidden shadow-sm">
                        {/* Background Watermarks */}
                        <div className="absolute top-0 right-0 opacity-[0.03] pointer-events-none transform translate-x-12 -translate-y-12">
                          <Search className="w-64 h-64 text-gray-900" />
                        </div>
                        <div className="absolute bottom-0 left-0 opacity-[0.03] pointer-events-none transform -translate-x-12 translate-y-12">
                          <Globe className="w-64 h-64 text-gray-900" />
                        </div>
                        
                        <div className="relative z-10 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-3">
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className="bg-[#ff9900] text-black text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-sm">
                                  Live Engine
                                </span>
                                <h3 className="text-base md:text-lg font-black tracking-tight text-gray-900 uppercase">
                                  Real-Time Amazon Search
                                </h3>
                              </div>
                              <p className="text-[11px] md:text-xs text-gray-550 font-sans font-medium">
                                Search products directly from Amazon.com to view live pricing and images.
                              </p>
                            </div>
                            <div className="flex items-center opacity-85 self-start sm:self-center">
                              <img
                                src="/amazon-logo.svg"
                                alt="Amazon Logo"
                                className="h-4.5 md:h-5 w-auto object-contain"
                              />
                            </div>
                          </div>

                          <form onSubmit={handleAmazonSearch} className="flex gap-2">
                            <div className="relative flex-1">
                              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                              <input
                                type="text"
                                value={amazonSearchQuery}
                                onChange={(e) => setAmazonSearchQuery(e.target.value)}
                                placeholder="Enter keyword (e.g. Hairdryer, Wireless Earbuds, Sneaker)..."
                                className="w-full bg-gray-50 border border-gray-250 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-[#ff9900] transition-all"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={amazonSearchLoading}
                              className="bg-[#ff9900] text-black font-bold text-xs px-6 py-2.5 rounded-xl hover:bg-amber-500 hover:shadow-xs transition-all shadow-xxs flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50"
                            >
                              {amazonSearchLoading ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-4.5 w-4.5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  <span>Searching...</span>
                                </>
                              ) : (
                                <span>Search</span>
                              )}
                            </button>
                          </form>

                          {amazonSearchError && (
                            <p className="text-xxs font-semibold text-red-500 mt-1 font-sans">
                              {amazonSearchError}
                            </p>
                          )}

                          {amazonSearchResults.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-4 border-t border-gray-100 animate-fadeIn">
                              {amazonSearchResults.map((item, idx) => (
                                <a
                                  key={idx}
                                  href={item.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group bg-gray-50/50 hover:bg-white border border-gray-200 hover:border-[#ff9900]/50 rounded-xl p-2.5 transition-all flex flex-col h-full text-left shadow-xxs hover:shadow-xs"
                                >
                                  <div className="aspect-square bg-white rounded-lg overflow-hidden flex items-center justify-center relative p-1.5 mb-2 border border-gray-100 group-hover:scale-95 transition-transform duration-300">
                                    <img
                                      src={item.imageUrl}
                                      alt={item.title}
                                      className="max-h-full max-w-full object-contain"
                                      onError={(e) => {
                                        e.currentTarget.src = "https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=500";
                                      }}
                                    />
                                    <span className="absolute bottom-1 right-1 bg-black/75 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-sm backdrop-blur-xs font-mono">
                                      ASIN: {item.asin}
                                    </span>
                                  </div>
                                  <div className="flex-1 flex flex-col justify-between space-y-1">
                                    <h4 className="text-[10px] md:text-[11px] font-bold text-gray-750 line-clamp-2 leading-tight group-hover:text-[#ff9900] transition-colors">
                                      {item.title}
                                    </h4>
                                    <div className="flex items-center justify-between pt-1">
                                      <span className="text-xs md:text-sm font-black text-gray-950 font-mono">
                                        ${item.price.toFixed(2)}
                                      </span>
                                      <span className="text-[8px] font-bold text-[#ff9900] opacity-0 group-hover:opacity-100 transform translate-x-1 group-hover:translate-x-0 transition-all flex items-center space-x-0.5">
                                        <span>View</span>
                                        <ArrowUpRight className="h-2.5 w-2.5" />
                                      </span>
                                    </div>
                                  </div>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* WFP Organization Support Card */}
                    <div className="max-w-4xl mx-auto px-1 md:px-0 mt-4 mb-4 pb-4">
                      <a
                        href="https://www.wfp.org/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex flex-col sm:flex-row items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-100 rounded-2xl p-4 transition-all duration-300 shadow-xxs hover:shadow-xs"
                      >
                        <div className="flex items-center space-x-3.5 text-left font-sans">
                          <div className="bg-blue-600 text-white p-2.5 rounded-xl group-hover:scale-110 transition-transform">
                            <Globe className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                              <span>World Food Programme</span>
                              <span className="bg-blue-200 text-blue-800 text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase">
                                Official Partner
                              </span>
                            </h4>
                            <p className="text-[10px] text-blue-700 font-medium font-sans mt-0.5 leading-relaxed">
                              Reviewers Hub proudly supports the UN World Food Programme (WFP) in fighting global hunger. Click to learn more about the cause.
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 sm:mt-0 bg-blue-600 group-hover:bg-blue-700 text-white font-bold text-xxs px-4 py-2 rounded-lg transition-colors flex items-center space-x-1 whitespace-nowrap self-end sm:self-center font-sans">
                          <span>Visit WFP.org</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </div>
                      </a>
                    </div>
                  </div>
                ) : selectedOrderCategory !== enabledPlatform ? (
                  /* Wrong category lock screen (or workspace not activated) */
                  enabledPlatform === null ? (
                    /* Case 1: Workspace not activated / locked */
                    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-4 max-w-xl mx-auto shadow-xs my-6">
                      <div className="h-14 w-14 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500 border border-red-100 animate-pulse">
                        <Lock className="h-6 w-6" />
                      </div>
                      <div className="space-y-1.5">
                        <h2 className="text-lg font-black text-gray-900">Campaign Evaluation Locked</h2>
                        <p className="text-xs text-gray-550 leading-relaxed font-sans font-medium">
                          Your workspace is not yet activated. Please submit a deposit request. Our compliance team will audit and activate your workspace network in up to 24 hours.
                        </p>
                      </div>
                      <div className="pt-2 flex justify-center space-x-3">
                        <button
                          onClick={() => setSelectedOrderCategory(null)}
                          className="px-4 py-2 border border-gray-305 text-gray-700 font-bold text-xs rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          Back to Categories
                        </button>
                        <button
                          onClick={() => setActiveTab('deposit')}
                          className="px-6 py-2.5 bg-amazon-gold hover:bg-[#e2b600] text-amazon-dark font-black text-xs rounded-lg transition-colors cursor-pointer border border-[#a88734]"
                        >
                          Go to Deposit Page
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Case 2: User clicked wrong category */
                    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-4 max-w-xl mx-auto shadow-xs my-6 animate-fadeIn">
                      <div className="h-14 w-14 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500 border border-red-100 animate-pulse">
                        <Lock className="h-6 w-6" />
                      </div>
                      <div className="space-y-3">
                        <h2 className="text-lg font-black text-gray-900">Workspace Category Locked</h2>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                          <p className="text-xs text-red-800 font-bold font-sans leading-relaxed">
                            "Your active workspace assigned by the administrator is {enabledPlatform} You cannot perform order reviews on other networks."
                          </p>
                        </div>
                      </div>
                      <div className="pt-2 flex justify-center space-x-3">
                        <button
                          onClick={() => setSelectedOrderCategory(null)}
                          className="px-4 py-2 border border-gray-305 text-gray-700 font-bold text-xs rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          Back to Categories
                        </button>
                        <button
                          onClick={() => {
                            setSelectedOrderCategory(enabledPlatform);
                            handleSelectPlatform(enabledPlatform);
                          }}
                          className="px-6 py-2.5 bg-amazon-gold hover:bg-[#e2b600] text-amazon-dark font-black text-xs rounded-lg transition-colors cursor-pointer border border-[#a88734]"
                        >
                          Go to {enabledPlatform} Workspace
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  /* Case 3: Correct active platform selected! Show standard orders workspace */
                  <div className="space-y-6 animate-fadeIn">
                    <div className="flex justify-between items-center">
                      <div>
                        <h2 className="text-lg font-black text-gray-900">Merchant Evaluation Tasks ({selectedOrderCategory})</h2>
                        <p className="text-xs text-gray-500 mt-1 font-sans">
                          Select a campaign below. Click "Start Review" to complete compliance steps. All payouts are strictly bounded between $0.50 and $2.50 to mirror legitimate testing commissions.
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedOrderCategory(null)}
                        className="px-3 py-1.5 border border-gray-350 text-gray-650 hover:bg-gray-50 font-bold text-xs rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        <span>All Categories</span>
                      </button>
                    </div>

                    {/* Sub-tabs: Pending vs Completed Gigs */}
                    <div className="flex border-b border-gray-200">
                      <button
                        onClick={() => {
                          setOrdersSubTab('pending');
                          setGigsPage(1);
                        }}
                        className={`pb-3 px-6 text-xs font-black uppercase tracking-wider transition-colors border-b-2 cursor-pointer ${ordersSubTab === 'pending'
                          ? 'border-amazon-gold text-[#131921] font-black'
                          : 'border-transparent text-gray-400 hover:text-gray-655'
                          }`}
                      >
                        Pending Tasks
                      </button>
                      <button
                        onClick={() => {
                          setOrdersSubTab('completed');
                          setGigsPage(1);
                        }}
                        className={`pb-3 px-6 text-xs font-black uppercase tracking-wider transition-colors border-b-2 cursor-pointer ${ordersSubTab === 'completed'
                          ? 'border-amazon-gold text-[#131921] font-black'
                          : 'border-transparent text-gray-400 hover:text-gray-655'
                          }`}
                      >
                        Completed Tasks ({currentPlatformData.completedOrders})
                      </button>
                    </div>

                    {currentPlatformData.isComboBlocked && currentPlatformData.comboDetails && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-left animate-pulse mt-4">
                        <div className="flex items-center space-x-3">
                          <div className="bg-amber-600 text-white p-2.5 rounded-lg flex-shrink-0">
                            <ShieldAlert className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-amber-900 uppercase">
                              Special Combo Order #{currentPlatformData.comboDetails.position} Triggered!
                            </h4>
                            <p className="text-[10px] text-amber-700 font-sans mt-0.5 leading-relaxed">
                              You have triggered a high-yield Special Combo order. Please complete the deposit of <strong>${currentPlatformData.comboDetails.triggerBalance.toFixed(2)} USD</strong> to unlock this workspace and continue.
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (currentPlatformData.comboDetails) {
                              setComboModalDetails({
                                triggerBalance: currentPlatformData.comboDetails.triggerBalance,
                                profitAmount: currentPlatformData.comboDetails.profitAmount,
                                currentBalance: currentPlatformData.walletBalance,
                                position: currentPlatformData.comboDetails.position
                              });
                              setIsComboModalOpen(true);
                            }
                          }}
                          className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase px-4 py-2 rounded-lg transition whitespace-nowrap self-end sm:self-center cursor-pointer font-sans"
                        >
                          View Combo Invoice
                        </button>
                      </div>
                    )}

                    {/* Search and Filters Bar */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs mt-4">
                      {/* Search bar */}
                      <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search campaign gigs by title..."
                          value={gigsSearch}
                          onChange={(e) => {
                            setGigsSearch(e.target.value);
                            setGigsPage(1); // Reset to page 1 on search
                          }}
                          className="w-full pl-9 pr-4 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold text-gray-800 font-medium"
                        />
                      </div>
                    </div>

                    {/* Tasks Grid */}
                    {(() => {
                      const filteredProducts = assignedProducts.filter(product => {
                        const matchesSearch = product.title.toLowerCase().includes(gigsSearch.toLowerCase());
                        const isCompleted = currentPlatformData.orders.some(o =>
                          o.productId === product.id &&
                          o.status === 'Completed' &&
                          new Date(o.createdAt).getTime() >= new Date(currentPlatformData.lastResetAt || 0).getTime()
                        );
                        const matchesSubTab = ordersSubTab === 'completed' ? isCompleted : !isCompleted;

                        return matchesSearch && matchesSubTab;
                      });

                      const displayProducts = ordersSubTab === 'pending' && filteredProducts.length > 0
                        ? [filteredProducts[0]]
                        : filteredProducts;

                      const pageSize = 10;
                      const totalPages = Math.ceil(displayProducts.length / pageSize) || 1;
                      const currentPage = Math.min(gigsPage, totalPages);
                      const paginatedProducts = displayProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

                      return (
                        <div className="space-y-6">
                          {paginatedProducts.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                              {paginatedProducts.map((product) => {
                                // Check if already completed
                                const isCompleted = currentPlatformData.orders.some(o =>
                                  o.productId === product.id &&
                                  o.status === 'Completed' &&
                                  new Date(o.createdAt).getTime() >= new Date(currentPlatformData.lastResetAt || 0).getTime()
                                );

                                return (
                                  <div
                                    key={product.id}
                                    className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-sm transition"
                                  >
                                    <div className="relative bg-gray-50 h-44 flex items-center justify-center p-4">
                                      <img src={product.image} alt={product.title} className="max-h-full max-w-full object-contain mix-blend-multiply" referrerPolicy="no-referrer" />
                                    </div>

                                    <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                                      <div className="space-y-1">
                                        <h3 className="text-xs font-bold text-gray-955 leading-snug line-clamp-2">{product.title}</h3>
                                      </div>

                                      <div className="pt-3 flex items-center justify-between">
                                        <div className="flex flex-col">
                                          <span className="text-[9px] text-gray-400 uppercase font-black">Commission</span>
                                          <span className="text-sm font-mono font-black text-green-600 mt-0.5">+${product.payout.toFixed(2)} USD</span>
                                        </div>

                                        {isCompleted ? (
                                          <span className="bg-green-50 text-green-700 font-bold text-[10px] px-2.5 py-1 rounded border border-green-200 uppercase">
                                            ✓ Claimed
                                          </span>
                                        ) : (
                                          <button
                                            onClick={() => startReviewFlow(product)}
                                            className="bg-[#F7CA00] hover:bg-[#E2B600] text-amazon-dark font-black text-[10px] px-3 py-1.5 rounded-lg border border-[#a88734] transition shadow-xs cursor-pointer flex items-center space-x-1"
                                          >
                                            <span>Start Review</span>
                                            <ArrowRight className="h-3 w-3" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
                              <p className="font-bold text-gray-500">
                                {assignedProducts.length === 0
                                  ? "No products assigned to this workspace yet."
                                  : ordersSubTab === 'pending'
                                    ? (currentPlatformData.completedOrders >= assignedProducts.length
                                      ? "You have completed all orders for today!"
                                      : "All assigned campaign tasks have been completed!")
                                    : "You have not completed any campaign tasks yet."}
                              </p>
                              <p className="text-[11px] text-gray-400 mt-1">
                                {assignedProducts.length === 0
                                  ? "Wait for the administrator to assign campaign products."
                                  : ordersSubTab === 'pending'
                                    ? (currentPlatformData.completedOrders >= assignedProducts.length
                                        ? (withdrawals.some((w: any) => w.status === 'Approved')
                                            ? `All ${assignedProducts.length}/${assignedProducts.length} orders completed. Waiting for admin to assign new orders.`
                                            : `All ${assignedProducts.length}/${assignedProducts.length} orders completed. You must complete a withdrawal before the admin can assign your next batch.`)
                                        : "Check back later or wait for administrators to unlock new batches.")
                                    : "Select pending campaigns to complete evaluation compliance tasks."}
                              </p>
                              {ordersSubTab === 'pending' && assignedProducts.length > 0 && currentPlatformData.completedOrders >= assignedProducts.length && !withdrawals.some((w: any) => w.status === 'Approved') && (
                                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 inline-block">
                                  <p className="text-[11px] text-amber-800 font-bold">
                                    Withdrawal Required for Next Batch
                                  </p>
                                  <p className="text-[10px] text-amber-600 mt-1">
                                    Complete a withdrawal (minimum $1) to unlock your next batch of orders.
                                  </p>
                                  <button
                                    onClick={() => setActiveTab('withdraw')}
                                    className="mt-2 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded-lg cursor-pointer transition"
                                  >
                                    Withdraw Now
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Pagination Controls */}
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                              <p className="text-xs text-gray-500 font-medium">
                                Showing page <strong className="font-bold text-gray-900">{currentPage}</strong> of <strong className="font-bold text-gray-900">{totalPages}</strong>
                              </p>
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => setGigsPage(p => Math.max(1, p - 1))}
                                  disabled={currentPage === 1}
                                  className="px-2.5 py-1.5 text-[10px] bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 text-gray-700 font-bold disabled:cursor-not-allowed cursor-pointer transition-colors"
                                >
                                  Previous
                                </button>
                                {Array.from({ length: totalPages }).map((_, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => setGigsPage(idx + 1)}
                                    className={`px-2.5 py-1.5 text-[10px] rounded border font-bold cursor-pointer transition-colors ${currentPage === idx + 1
                                      ? 'bg-[#131921] border-[#131921] text-white font-black'
                                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                      }`}
                                  >
                                    {idx + 1}
                                  </button>
                                ))}
                                <button
                                  onClick={() => setGigsPage(p => Math.min(totalPages, p + 1))}
                                  disabled={currentPage === totalPages}
                                  className="px-2.5 py-1.5 text-[10px] bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 text-gray-700 font-bold disabled:cursor-not-allowed cursor-pointer transition-colors"
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* ================================== RECORD (COMPLETED EVALUATIONS) ================================== */}
            {activeTab === 'record' && (
              <div className="space-y-6 animate-fadeIn text-left">
                {activePlatform === null || enabledPlatform === null ? (
                  /* Blocked/Empty state */
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-4 max-w-xl mx-auto shadow-xs my-6">
                    <div className="h-14 w-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-400 border border-gray-150">
                      <ClipboardCheck className="h-7 w-7" />
                    </div>
                    <div className="space-y-1.5">
                      <h2 className="text-lg font-black text-gray-900">No Evaluation History</h2>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        There are no recorded evaluations. Select a network, fund your wallet, and submit feedback campaigns to register transaction ledger history.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Data table format */
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-black text-gray-900">Evaluation Records Ledger</h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Audit ledger tracking all completed evaluations and pending payouts inside the <strong className="text-gray-800 font-bold">{activePlatform}</strong> network.
                        </p>
                      </div>

                      <div className="flex-shrink-0 flex items-center space-x-3">
                        <button
                          onClick={handleDownloadCSV}
                          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-705 font-bold text-xs rounded-lg border border-gray-300 transition flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Export CSV</span>
                        </button>

                        {(currentPlatformData.completedOrders >= 25 || withdrawals.some((w: any) => w.status === 'Approved')) ? (
                          <button
                            onClick={() => setIsWithdrawOpen(true)}
                            className="bg-green-600 hover:bg-green-700 text-white font-black text-xs px-4 py-2.5 rounded-lg shadow transition flex items-center space-x-1.5 cursor-pointer"
                          >
                            <Unlock className="h-4 w-4" />
                            <span>Withdraw Balance (${currentPlatformData.walletBalance.toFixed(2)})</span>
                          </button>
                        ) : (
                          <div className="space-y-1 text-right">
                            <button
                              disabled
                              className="bg-gray-100 text-gray-400 font-black text-xs px-3.5 py-2 rounded-lg border border-gray-200 cursor-not-allowed flex items-center space-x-1.5"
                            >
                              <Lock className="h-3.5 w-3.5 text-gray-400" />
                              <span>Withdrawal Locked</span>
                            </button>
                            <p className="text-[9px] text-amber-600 font-bold leading-none font-sans mt-1">
                              Complete {assignedProducts.length} orders first ({currentPlatformData.completedOrders}/{assignedProducts.length}).
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Filters Row */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1.5">
                        <span className="text-[10px] text-gray-400 uppercase font-black">Status:</span>
                        {(['All', 'Completed', 'Pending'] as const).map((st) => (
                          <button
                            key={st}
                            onClick={() => setOrdersStatusFilter(st as any)}
                            className={`px-3 py-1 rounded-lg text-[10px] font-black transition-colors uppercase cursor-pointer border ${ordersStatusFilter === st
                              ? 'bg-[#131921] border-[#131921] text-white shadow-xs'
                              : 'bg-gray-100 border border-gray-200 hover:bg-gray-200 text-gray-600 hover:text-gray-900'
                              }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center space-x-3 self-start md:self-auto">
                        <span className="text-[10px] text-gray-400 uppercase font-black">Date Range:</span>
                        <select
                          value={ordersDateFilter}
                          onChange={(e) => setOrdersDateFilter(e.target.value as any)}
                          className="px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded text-[10px] font-bold text-gray-700 focus:outline-none"
                        >
                          <option value="All">All Transactions</option>
                          <option value="Last 7 days">Last 7 Days</option>
                          <option value="This month">This Month</option>
                        </select>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[9px] tracking-wider">
                              <th className="py-3 px-4">Record ID</th>
                              <th className="py-3 px-4">Product Evaluation Campaign</th>
                              <th className="py-3 px-4">Order ID Ref</th>
                              <th className="py-3 px-4 text-right">Commission Payout</th>
                              <th className="py-3 px-4 text-center">Status</th>
                              <th className="py-3 px-4 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 font-medium text-gray-750 bg-white">
                            {(() => {
                              const filteredOrders = currentPlatformData.orders.filter(order => {
                                const matchesStatus = ordersStatusFilter === 'All' || order.status === ordersStatusFilter;
                                let matchesDate = true;
                                if (ordersDateFilter === 'Last 7 days') {
                                  matchesDate = order.date.includes('09') || order.date.includes('08') || order.date.includes('07') || order.date.includes('06');
                                } else if (ordersDateFilter === 'This month') {
                                  matchesDate = order.date.includes('Jul');
                                }
                                return matchesStatus && matchesDate;
                              });

                              if (filteredOrders.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={6} className="py-10 text-center text-gray-400 font-bold bg-white">
                                      No transaction records found inside the {activePlatform} ledger.
                                    </td>
                                  </tr>
                                );
                              }

                              return filteredOrders.map((order) => (
                                <tr key={order.id} className="hover:bg-gray-50/80 transition">
                                  <td className="py-3.5 px-4 font-mono text-gray-900 font-bold">{order.id}</td>
                                  <td className="py-3.5 px-4">
                                    <p className="font-bold text-gray-950 leading-tight line-clamp-1">{order.productTitle}</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">{order.date}</p>
                                  </td>
                                  <td className="py-3.5 px-4 font-mono text-gray-500 font-semibold">{order.orderId || 'N/A'}</td>
                                  <td className="py-3.5 px-4 text-right font-mono font-black text-green-600">+${order.payout.toFixed(2)}</td>
                                  <td className="py-3.5 px-4 text-center">
                                    <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded border ${order.status === 'Completed'
                                      ? 'bg-green-50 text-green-700 border-green-200 font-bold'
                                      : 'bg-amber-50 text-amber-700 border-amber-200 font-bold'
                                      }`}>
                                      {order.status}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-center">
                                    <button
                                      onClick={() => setSelectedOrderDetail(order)}
                                      className="px-2.5 py-1 text-[10px] font-bold text-amazon-blue bg-blue-50 border border-blue-205 hover:bg-blue-100 transition rounded cursor-pointer"
                                    >
                                      View
                                    </button>
                                  </td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ================================== WITHDRAW ================================== */}
            {activeTab === 'withdraw' && (
              <div className="space-y-6 animate-fadeIn text-left">
                {enabledPlatform === null || (currentPlatformData.completedOrders < 25 && !withdrawals.some((w: any) => w.status === 'Approved')) ? (
                  /* Case 1: Workspace not activated OR first-time user with < 25 orders (Locked) */
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-4 max-w-xl mx-auto shadow-xs my-6 animate-fadeIn">
                    <div className="h-14 w-14 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500 border border-red-100 animate-pulse">
                      <Lock className="h-6 w-6" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-lg font-black text-gray-900">Withdrawal Operations Locked</h2>
                      {enabledPlatform === null ? (
                        <p className="text-xs text-gray-500 leading-relaxed font-sans font-medium">
                          Your workspace is not yet activated. Please submit a deposit request. Our compliance team will audit and activate your workspace network in up to 24 hours.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-xs text-gray-500 leading-relaxed font-sans font-medium">
                            Minimum compliance threshold requires {assignedProducts.length} completed reviews. Currently completed: <strong className="text-red-655 font-mono">{currentPlatformData.completedOrders}/{assignedProducts.length}</strong>.
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="pt-2">
                      {enabledPlatform === null ? (
                        <button
                          onClick={() => setActiveTab('deposit')}
                          className="px-6 py-2.5 bg-amazon-gold hover:bg-[#e2b600] text-amazon-dark font-black text-xs rounded-lg transition-colors cursor-pointer border border-[#a88734]"
                        >
                          Go to Deposit Page
                        </button>
                      ) : (
                        <button
                          onClick={() => setActiveTab('orders')}
                          className="px-6 py-2.5 bg-amazon-gold hover:bg-[#e2b600] text-amazon-dark font-black text-xs rounded-lg transition-colors cursor-pointer border border-[#a88734]"
                        >
                          Complete Orders ({currentPlatformData.completedOrders}/{assignedProducts.length})
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Case 2: Activated workspace and 25+ orders completed — show form and history */
                  <>
                    <div>
                      <h2 className="text-lg font-black text-gray-900">Request Payout Withdrawal</h2>
                      <p className="text-xs text-gray-505 mt-1 font-sans font-medium">
                        Submit a secure withdrawal request to transfer your verified review commissions to your bound USDT wallet address.
                      </p>
                    </div>

                    {/* First-time user: mandatory withdrawal notice */}
                    {currentPlatformData.completedOrders >= 25 && !withdrawals.some((w: any) => w.status === 'Approved') && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start space-x-3 text-amber-800">
                        <ShieldAlert className="h-5 w-5 flex-shrink-0 mt-0.5 text-amber-600" />
                        <div className="text-xs leading-relaxed font-semibold">
                          <strong className="text-amber-900 font-bold">First Batch Withdrawal Required:</strong>
                          <p className="mt-0.5 text-amber-700 font-sans">
                            You have completed your first batch of 25 orders. A withdrawal is required before the admin can assign your next batch of orders. You may withdraw any amount (minimum $1).
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Left Column: Withdrawal Form */}
                      <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 p-6 space-y-6 shadow-xs">
                        <div>
                          <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">New Payout Request</h3>
                          <p className="text-xs text-gray-400 mt-0.5 font-sans">Withdraw funds from your active workspace balance.</p>
                        </div>
                        {/* Warning notices if locked — only for first-time users */}
                        {currentPlatformData.completedOrders < assignedProducts.length && !withdrawals.some((w: any) => w.status === 'Approved') && (
                          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3 text-red-800">
                            <Lock className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-600" />
                            <div className="text-xs leading-relaxed font-semibold">
                              <strong className="text-red-900 font-bold">Withdrawal Locked:</strong>
                              <p className="mt-0.5 text-red-700 font-sans">
                                Minimum compliance threshold requires {assignedProducts.length} completed reviews. Currently completed: {currentPlatformData.completedOrders}/{assignedProducts.length}. Please complete more task evaluations to authorize withdrawals.
                              </p>
                            </div>
                          </div>
                        )}

                        {!isAddressBound && (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start justify-between space-x-3 text-amber-800">
                            <div className="flex items-start space-x-3">
                              <ShieldAlert className="h-5 w-5 flex-shrink-0 mt-0.5 text-amber-600" />
                              <div className="text-xs leading-relaxed font-semibold">
                                <strong className="text-amber-900 font-bold">USDT Address Required:</strong>
                                <p className="mt-0.5 text-amber-700 font-sans">
                                  Please configure and bind your receiving wallet address in the Profile settings tab before requesting withdrawals.
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('profile');
                                setProfileActiveSection('wallet');
                              }}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xxs uppercase font-black rounded-lg transition-colors cursor-pointer whitespace-nowrap self-center"
                            >
                              Bind Address →
                            </button>
                          </div>
                        )}

                        <form onSubmit={handleWithdrawSubmit} className="space-y-4">
                          {/* Active Platform details */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 p-4 border border-gray-200 rounded-xl">
                              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Active Workspace</span>
                              <p className="text-xs font-black text-gray-900 mt-1 uppercase">{activePlatform || 'Amazon'}</p>
                            </div>
                            <div className="bg-gray-50 p-4 border border-gray-200 rounded-xl">
                              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Available Balance</span>
                              <p className="text-xs font-black text-green-600 mt-1">${currentPlatformData.walletBalance.toFixed(2)}</p>
                            </div>
                          </div>

                          {/* Bound USDT Address display */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-baseline">
                              <label className="text-[10px] text-gray-500 uppercase font-black">Linked USDT Payout Address</label>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTab('profile');
                                  setProfileActiveSection('wallet');
                                }}
                                className="text-[10px] text-amazon-blue hover:underline font-bold font-sans"
                              >
                                Change in Profile →
                              </button>
                            </div>
                            <input
                              type="text"
                              readOnly
                              value={defaultWalletAddress || 'No receiving wallet linked'}
                              className="w-full px-3 py-2.5 text-xs bg-gray-50 border border-gray-300 rounded-lg text-gray-500 font-mono"
                            />
                          </div>

                          {/* Amount input */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] text-gray-550 uppercase font-black">Withdrawal Amount (USDT)</label>
                              <input
                                type="number"
                                step="any"
                                required
                                disabled={(currentPlatformData.completedOrders < 25 && !withdrawals.some((w: any) => w.status === 'Approved')) || !isAddressBound}
                                placeholder="Min 1.00"
                                value={newWithdrawAmount}
                                onChange={(e) => setNewWithdrawAmount(e.target.value)}
                                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold font-medium text-gray-800 disabled:bg-gray-100 disabled:text-gray-400"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-gray-555 uppercase font-black font-sans">Withdrawal Password</label>
                              <input
                                type="password"
                                required
                                disabled={(currentPlatformData.completedOrders < 25 && !withdrawals.some((w: any) => w.status === 'Approved')) || !isAddressBound}
                                placeholder="Enter your withdrawal password"
                                value={newWithdrawPassword}
                                onChange={(e) => setNewWithdrawPassword(e.target.value)}
                                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold font-medium text-gray-800 disabled:bg-gray-100 disabled:text-gray-400"
                              />
                            </div>
                          </div>

                          <button
                            type="submit"
                            disabled={(currentPlatformData.completedOrders < 25 && !withdrawals.some((w: any) => w.status === 'Approved')) || !isAddressBound || isSubmittingWithdraw}
                            className="w-full py-3 bg-amazon-gold hover:bg-[#e2b600] disabled:bg-gray-200 text-amazon-dark disabled:text-gray-400 font-black text-xs rounded-lg transition-colors cursor-pointer text-center disabled:cursor-not-allowed border-0"
                          >
                            {isSubmittingWithdraw ? (
                              <span className="flex items-center justify-center">
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                              </span>
                            ) : (
                              'Submit Payout Request'
                            )}
                          </button>
                        </form>
                      </div>

                      {/* Right Column: Withdrawal request history */}
                      <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col space-y-4">
                        <div>
                          <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">Recent Payout History</h3>
                          <p className="text-xs text-gray-400 mt-0.5 font-sans">Review your submitted withdrawals and ledger standing.</p>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3.5 pt-2">
                          {withdrawals.map((req) => (
                            <div key={req.id} className="border border-gray-150 p-4.5 rounded-xl bg-gray-50/50 space-y-3 text-xs">
                              <div className="flex justify-between items-center border-b border-gray-150 pb-2">
                                <span className="font-bold text-gray-855">Withdrawal Request</span>
                                <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded border ${req.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-200 font-bold' :
                                  req.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200 font-bold' :
                                    'bg-amber-50 text-amber-700 border-amber-200 animate-pulse font-bold'
                                  }`}>
                                  {req.status}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-y-1.5 text-gray-600 font-medium font-sans">
                                <div>Amount:</div>
                                <div className="text-right font-black font-mono text-gray-900">${parseFloat(req.amount).toFixed(2)} USDT</div>
                                <div>Address:</div>
                                <div className="text-right font-mono text-[10px] text-gray-400 truncate max-w-[120px] ml-auto cursor-pointer" title={req.address || defaultWalletAddress}>
                                  {(req.address || defaultWalletAddress || '').slice(0, 8)}...{(req.address || defaultWalletAddress || '').slice(-8)}
                                </div>
                                <div>Date:</div>
                                <div className="text-right font-mono text-gray-500">{new Date(req.created_at || req.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</div>
                              </div>
                            </div>
                          ))}

                          {withdrawals.length === 0 && (
                            <div className="text-center py-12 text-gray-400">
                              <Wallet className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                              <p className="font-bold font-sans">No withdrawals requested yet.</p>
                              <p className="text-[11px] text-gray-400 mt-0.5 font-sans">Submit details on the left to request payout.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ================================== PROFILE ================================== */}
            {activeTab === 'profile' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <div>
                  <h2 className="text-lg font-black text-gray-900">User Profile Workspace</h2>
                  <p className="text-xs text-gray-505 mt-1 font-sans">
                    Configure your reviewer identity persona, link decentralized receiving wallets, and update transaction authorization security keys.
                  </p>
                </div>

                {/* Profile Sub-Section Tab Navigation */}
                <div className="flex flex-col sm:flex-row border-b border-gray-200 sm:space-x-1 space-y-1.5 sm:space-y-0 pb-1 sm:pb-0.5">
                  {([
                    { key: 'details', label: '👤 Identity & Persona' },
                    { key: 'wallet', label: '💳 Payout Wallet Setup' },
                    { key: 'security', label: '🛡️ Security Credentials' }
                  ] as const).map((sec) => (
                    <button
                      key={sec.key}
                      onClick={() => setProfileActiveSection(sec.key)}
                      className={`py-2.5 sm:py-2.5 px-4 text-xs font-black uppercase tracking-wider transition-all border-l-2 sm:border-l-0 sm:border-b-2 whitespace-nowrap cursor-pointer text-left sm:text-center flex items-center justify-between sm:justify-center w-full sm:w-auto rounded-lg sm:rounded-none bg-gray-50/50 sm:bg-transparent ${profileActiveSection === sec.key
                        ? 'border-amazon-gold text-[#a88734] font-black bg-[#fcf8e3]/30 sm:bg-transparent'
                        : 'border-transparent text-gray-400 hover:text-gray-700 hover:bg-gray-100/50 sm:hover:bg-transparent'
                        }`}
                    >
                      <span>{sec.label}</span>
                      <ChevronRight className="h-3.5 w-3.5 block sm:hidden text-gray-400" />
                    </button>
                  ))}
                </div>

                {/* Section Content Router */}
                <div>
                  {/* TAB 1: IDENTITY & PERSONA */}
                  {profileActiveSection === 'details' && (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-fadeIn">
                      {/* Left: Profile Photo Upload Card */}
                      <div className="md:col-span-4 bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center justify-center text-center space-y-4 shadow-xs">
                        <div className="space-y-2">
                          <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">Profile Photo</h3>
                          <p className="text-[11px] text-gray-450 leading-snug">Upload a custom profile photo for your reviewer account.</p>
                        </div>

                        <div className="py-4">
                          <div className="relative group h-24 w-24 rounded-full overflow-hidden border-4 border-white shadow-md mx-auto bg-gray-50 flex items-center justify-center">
                            {profile_photo ? (
                              <img src={profile_photo} alt="Profile" className="h-full w-full object-cover" />
                            ) : (
                              <User className="h-12 w-12 text-gray-400" />
                            )}

                            <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-black uppercase tracking-wider cursor-pointer transition-opacity">
                              Change
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoChange}
                                className="hidden"
                              />
                            </label>
                          </div>

                          {profile_photo && (
                            <button
                              type="button"
                              onClick={async () => {
                                const token = localStorage.getItem('reviewer_auth_token');
                                try {
                                  const res = await fetch(`${API_BASE}/auth/update-profile-photo`, {
                                    method: 'PUT',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'Authorization': `Bearer ${token}`
                                    },
                                    body: JSON.stringify({ profile_photo: null })
                                  });
                                  if (res.ok) {
                                    setProfile_photo(null);
                                    localStorage.removeItem(`profile_photo_${username}`);
                                    showToast("✓ Profile photo removed.");
                                  } else {
                                    showToast("Failed to remove profile photo.");
                                  }
                                } catch (err) {
                                  showToast("Server connection error.");
                                }
                              }}
                              className="mt-2 text-[10px] text-red-500 hover:text-red-600 font-bold uppercase tracking-wider cursor-pointer"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="w-full border-t border-gray-100 pt-4">
                          <label className="inline-block px-4 py-2 bg-amazon-gold hover:bg-[#e2b600] text-amazon-dark font-black text-[10px] rounded-lg border border-[#a88734] transition cursor-pointer uppercase">
                            Upload Photo
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoChange}
                              className="hidden"
                            />
                          </label>
                          <p className="text-[9px] text-gray-400 mt-2">Supports JPG, PNG under 1.5MB</p>
                        </div>
                      </div>

                      {/* Right: Contact details card */}
                      <div className="md:col-span-8 bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-xs">
                        <div>
                          <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">Identity Contact Details</h3>
                          <p className="text-xs text-gray-450 mt-0.5">Configure details linked to your reviewer profile standing.</p>
                        </div>

                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (isSavingProfile) return;
                            setIsSavingProfile(true);
                            const token = localStorage.getItem('reviewer_auth_token');
                            try {
                              const res = await fetch(`${API_BASE}/auth/update-profile`, {
                                method: 'PUT',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({ email: profileEmail, phone: profilePhone })
                              });
                              const data = await res.json();
                              if (res.ok) {
                                showToast("✓ Profile identity credentials saved successfully.");
                                fetchAllData();
                              } else {
                                showToast(data.error || "Failed to update profile details.");
                              }
                            } catch (err) {
                              showToast("Server connection error. Failed to save details.");
                            } finally {
                              setIsSavingProfile(false);
                            }
                          }}
                          className="space-y-4 text-xs"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <span className="text-gray-400 font-bold block mb-1 text-[10px] uppercase">Reviewer ID</span>
                              <span className="font-mono text-gray-800 bg-gray-50 px-3 py-2 rounded-lg block border border-gray-200 font-black">
                                US-REV-26-99A
                              </span>
                            </div>
                            <div className="space-y-1">
                              <span className="text-gray-400 font-bold block mb-1 text-[10px] uppercase">Profile Standing</span>
                              <span className="text-green-700 bg-green-50 font-bold uppercase px-3 py-2 rounded-lg block border border-green-200 text-center font-sans">
                                Verified Reviewer Node
                              </span>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 uppercase font-black">Account Username</label>
                            <input
                              type="text"
                              disabled
                              value={username}
                              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-400 font-bold font-mono cursor-not-allowed outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 uppercase font-black">Email Address</label>
                            <input
                              type="email"
                              required
                              value={profileEmail}
                              onChange={(e) => setProfileEmail(e.target.value)}
                              className="w-full px-3 py-2 text-xs border border-gray-350 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold font-medium text-gray-855"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 uppercase font-black">Phone Number</label>
                            <input
                              type="text"
                              required
                              value={profilePhone}
                              onChange={(e) => setProfilePhone(e.target.value)}
                              className="w-full px-3 py-2 text-xs border border-gray-350 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold font-medium text-gray-855"
                            />
                          </div>

                          <div className="pt-2">
                            <button
                              type="submit"
                              disabled={isSavingProfile}
                              className="px-6 py-2 bg-[#131921] hover:bg-black disabled:bg-gray-400 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer text-center disabled:cursor-not-allowed"
                            >
                              {isSavingProfile ? (
                                <span className="flex items-center">
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Saving...
                                </span>
                              ) : (
                                'Save Identity Settings'
                              )}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: PAYOUT WALLET SETUP */}
                  {profileActiveSection === 'wallet' && (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-fadeIn">
                      {/* Left: Receipt details input */}
                      <div className="md:col-span-7 bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-xs">
                        <div>
                          <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">Payout Address Configuration</h3>
                          <p className="text-xs text-gray-450 mt-0.5">Specify the cryptographic address where your review commissions will be sent.</p>
                        </div>

                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (isBindingWallet) return;
                            setIsBindingWallet(true);
                            const token = localStorage.getItem('reviewer_auth_token');
                            try {
                              const res = await fetch(`${API_BASE}/auth/bind-usdt`, {
                                method: 'PUT',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({ address: defaultWalletAddress })
                              });
                              const data = await res.json();
                              if (res.ok) {
                                showToast("✓ Receipt wallet address bound and locked successfully!");
                                setIsAddressBound(true);
                                fetchAllData();
                              } else {
                                showToast(data.error || "Failed to bind wallet address.");
                              }
                            } catch (err) {
                              showToast("Server connection error. Failed to save address.");
                            } finally {
                              setIsBindingWallet(false);
                            }
                          }}
                          className="space-y-4 text-xs"
                        >
                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 uppercase font-black">Default receiving network</label>
                            <select
                              value={defaultNetwork}
                              onChange={(e) => setDefaultNetwork(e.target.value)}
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-350 rounded-lg text-xs font-bold text-gray-800 focus:outline-none"
                            >
                              <option value="TRC-20">USDT (TRC-20 Network)</option>
                              <option value="ERC-20">USDT (ERC-20 Network)</option>
                              <option value="BTC">Bitcoin (SegWit BTC Address)</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 uppercase font-black">Your Receiving Address ({defaultNetwork})</label>
                            <input
                              type="text"
                              required
                              value={defaultWalletAddress}
                              onChange={(e) => setDefaultWalletAddress(e.target.value)}
                              placeholder={`Enter receiving ${defaultNetwork === 'BTC' ? 'BTC' : 'USDT'} address`}
                              className="w-full px-3 py-2 text-xs border border-gray-305 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold text-gray-800 font-mono"
                            />
                          </div>

                          <div className="pt-2">
                            <button
                              type="submit"
                              disabled={isBindingWallet}
                              className="px-6 py-2 bg-[#131921] hover:bg-black disabled:bg-gray-400 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer text-center disabled:cursor-not-allowed"
                            >
                              {isBindingWallet ? (
                                <span className="flex items-center">
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Linking...
                                </span>
                              ) : (
                                'Link Payout Wallet'
                              )}
                            </button>
                          </div>
                        </form>
                      </div>

                      {/* Right: Wallet Balance Stats Visual */}
                      <div className="md:col-span-5 bg-white rounded-xl border border-gray-200 p-6 space-y-4.5 shadow-xs flex flex-col justify-between">
                        <div>
                          <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">Wallet Overview</h3>
                          <p className="text-xs text-gray-450 mt-0.5 font-sans">Visual balance metrics linked to your profile node.</p>
                        </div>

                        <div className="space-y-3.5 border-t border-b border-gray-100 py-4 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-450 font-medium">Collateral Deposit:</span>
                            <span className="font-mono font-black text-gray-800">$10.00 USD</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-450 font-medium">Feedback Profit:</span>
                            <span className="font-mono font-black text-green-600">+${currentPlatformData.profitEarned.toFixed(2)} USD</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-450 font-medium">Referral Commissions:</span>
                            <span className="font-mono font-black text-amazon-blue">+$4.50 USD</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-450 font-medium">Synchronization Standing:</span>
                            <span className="text-[10px] text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200 uppercase font-bold font-sans">
                              Active Node
                            </span>
                          </div>
                        </div>

                        <div className="text-[10px] text-gray-400 leading-normal flex items-start space-x-1.5">
                          <Info className="h-3.5 w-3.5 mt-0.5 text-gray-400 flex-shrink-0" />
                          <p>
                            Node ledger limits are refreshed daily. Completed evaluations are automatically settled to your receipt address after threshold compliance.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: SECURITY CREDENTIALS */}
                  {profileActiveSection === 'security' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
                      {/* Left: Change Login Password */}
                      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-xs">
                        <div>
                          <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">Account Password</h3>
                          <p className="text-xs text-gray-455 mt-0.5">Modify the security credentials used to log in to your account.</p>
                        </div>

                        <form onSubmit={handleChangePassword} className="space-y-3.5 text-xs">
                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 uppercase font-black">Current Password</label>
                            <input
                              type="password"
                              required
                              value={oldPassword}
                              onChange={(e) => setOldPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold text-gray-850"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 uppercase font-black">New Password</label>
                            <input
                              type="password"
                              required
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Min 8 characters"
                              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold text-gray-855"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 uppercase font-black">Confirm New Password</label>
                            <input
                              type="password"
                              required
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Re-enter password"
                              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold text-gray-855"
                            />
                          </div>

                          <div className="pt-2">
                            <button
                              type="submit"
                              disabled={isSavingPassword}
                              className="w-full py-2.5 bg-[#131921] hover:bg-black disabled:bg-gray-400 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer text-center disabled:cursor-not-allowed"
                            >
                              {isSavingPassword ? (
                                <span className="flex items-center justify-center">
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Updating...
                                </span>
                              ) : (
                                'Update Account Password'
                              )}
                            </button>
                          </div>
                        </form>
                      </div>

                      {/* Right: Change Withdrawal PIN */}
                      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-xs">
                        <div>
                          <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">Withdrawal PIN</h3>
                          <p className="text-xs text-gray-455 mt-0.5">Modify the security code required to authorize payout withdrawals.</p>
                        </div>

                        <form onSubmit={handleChangeWithdrawalPassword} className="space-y-3.5 text-xs">
                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 uppercase font-black">Current Withdrawal PIN</label>
                            <input
                              type="password"
                              required
                              value={oldWithdrawalPassword}
                              onChange={(e) => setOldWithdrawalPassword(e.target.value)}
                              placeholder="••••"
                              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold text-gray-855"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 uppercase font-black">New Withdrawal PIN</label>
                            <input
                              type="password"
                              required
                              value={newWithdrawalPassword}
                              onChange={(e) => setNewWithdrawalPassword(e.target.value)}
                              placeholder="4 digits"
                              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold text-gray-855"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 uppercase font-black">Confirm New Withdrawal PIN</label>
                            <input
                              type="password"
                              required
                              value={confirmWithdrawalPassword}
                              onChange={(e) => setConfirmWithdrawalPassword(e.target.value)}
                              placeholder="Re-enter PIN"
                              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold text-gray-855"
                            />
                          </div>

                          <div className="pt-2">
                            <button
                              type="submit"
                              disabled={isSavingPIN}
                              className="w-full py-2.5 bg-[#131921] hover:bg-black disabled:bg-gray-400 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer text-center disabled:cursor-not-allowed"
                            >
                              {isSavingPIN ? (
                                <span className="flex items-center justify-center">
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Updating...
                                </span>
                              ) : (
                                'Update Withdrawal PIN'
                              )}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ================================== INVITATION ================================== */}
            {activeTab === 'invitation' && (
              <div className="space-y-6 animate-fadeIn text-left max-w-2xl">
                <div>
                  <h2 className="text-lg font-black text-gray-900">Invite & Earn</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Share your referral code with friends. Earn $1.50 credited to your wallet for every referral who registers and completes 3 verified reviews.
                  </p>
                </div>

                {/* Invitation Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-5">
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">Your Referral Details</h3>

                  {/* Referral Code */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-400 uppercase font-black">Referral Code</label>
                    <div className="flex bg-gray-50 border border-gray-300 rounded-lg overflow-hidden">
                      <input
                        type="text"
                        readOnly
                        value={referralCode || 'Pending'}
                        className="flex-1 px-3 py-2.5 text-sm font-mono font-black bg-transparent text-gray-900 tracking-widest"
                      />
                      <button
                        onClick={() => handleCopyText(referralCode || 'Pending', 'Referral Code')}
                        className="px-4 bg-[#131921] hover:bg-black text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-colors"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy</span>
                      </button>
                    </div>
                  </div>

                  {/* Invite Link */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-400 uppercase font-black">Invite Link</label>
                    <div className="flex bg-gray-50 border border-gray-300 rounded-lg overflow-hidden">
                      <input
                        type="text"
                        readOnly
                        value={referralCode ? `https://www.amazonecommercehub.com/register?ref=${referralCode}` : 'https://www.amazonecommercehub.com/register'}
                        className="flex-1 px-3 py-2.5 text-xs font-mono bg-transparent text-gray-600 truncate"
                      />
                      <button
                        onClick={() => handleCopyText(referralCode ? `https://www.amazonecommercehub.com/register?ref=${referralCode}` : 'https://www.amazonecommercehub.com/register', 'Invite Link')}
                        className="px-4 bg-[#131921] hover:bg-black text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-colors flex-shrink-0"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Link</span>
                      </button>
                    </div>
                  </div>

                  {/* QR Code */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-400 uppercase font-black">QR Code</label>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl flex flex-col items-center justify-center py-6 space-y-3">
                      <div className="bg-white p-3.5 rounded-lg border border-gray-200 shadow-sm flex items-center justify-center">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(referralCode ? `https://www.amazonecommercehub.com/register?ref=${referralCode}` : 'https://www.amazonecommercehub.com/register')}`}
                          alt="Referral Link QR Code"
                          className="h-36 w-36 select-none pointer-events-none"
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-black text-gray-800">Scan to Register</p>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">{referralCode ? `ref=${referralCode}` : 'ref=YOUR_CODE'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Commission info card */}
                <div className="bg-[#131921] text-white rounded-xl p-5 space-y-2">
                  <p className="text-xs font-black uppercase tracking-wider text-amazon-gold">How it works</p>
                  <ul className="text-xs text-gray-300 space-y-1.5 leading-relaxed list-none">
                    <li>① Share your code or link with your contacts.</li>
                    <li>② They register using your referral link.</li>
                    <li>③ Once they complete 3 verified reviews — you earn <strong className="text-amazon-gold">$1.50</strong> automatically.</li>
                  </ul>
                </div>
              </div>
            )}


            {/* ================================== CUSTOMER SERVICE ================================== */}
            {activeTab === 'customer-service' && (
              <div className="space-y-6 animate-fadeIn text-left max-w-4xl">
                <div>
                  <h2 className="text-lg font-black text-gray-900">Support Desk Center</h2>
                  <p className="text-xs text-gray-505 mt-1 font-sans">
                    Connect directly with our 24/7 client operations desk or message our secure telegram channel for quick support.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Live chat widget */}
                  <div className="lg:col-span-8 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-[380px] md:min-h-[500px]">
                    {/* Chat Box Header */}
                    <div className="bg-[#131921] px-4 py-3 md:px-5 md:py-4 flex items-center space-x-3 text-white border-b border-gray-800">
                      <div className="relative flex-shrink-0">
                        <img
                          src="/pic.jpeg"
                          alt="CS Logo"
                          className="h-9 w-9 md:h-10 md:w-10 rounded-full object-cover border border-gray-600"
                        />
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 rounded-full border-2 border-[#131921]" />
                      </div>
                      <div>
                        <h3 className="text-xs font-black text-white leading-none">E-Commerce Support Desk</h3>
                        <p className="text-[9px] text-green-400 mt-1 font-sans font-bold uppercase tracking-wider">Active Response Node</p>
                      </div>
                    </div>

                    {/* Message Container Area */}
                    <div className="flex-1 p-3 md:p-4 bg-gray-50 overflow-y-auto space-y-3.5 max-h-[260px] md:max-h-[360px] min-h-[220px] md:min-h-[320px] flex flex-col justify-between">
                      <div className="space-y-4 flex-1">
                        {chatMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[85%] rounded-xl px-3 py-2 md:px-4 md:py-2.5 text-xs shadow-xxs border ${msg.sender === 'user'
                              ? 'bg-[#131921] border-[#131921] text-white rounded-tr-none'
                              : 'bg-white border-gray-200 text-gray-800 rounded-tl-none'
                              }`}>
                              {msg.text.startsWith('data:image/') || msg.text.startsWith('/uploads/') ? (
                                <img
                                  src={msg.text.startsWith('/') ? `${API_BASE.replace('/api', '')}${msg.text}` : msg.text}
                                  alt="Screenshot proof"
                                  className="max-w-xs rounded-lg border shadow-3xs cursor-pointer hover:opacity-90 transition"
                                  onClick={() => window.open(msg.text.startsWith('/') ? `${API_BASE.replace('/api', '')}${msg.text}` : msg.text, '_blank')}
                                />
                              ) : (
                                <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                              )}
                              <span className={`block text-[9px] mt-1.5 text-right font-mono ${msg.sender === 'user' ? 'text-gray-400' : 'text-gray-450'
                                }`}>
                                {msg.time}
                              </span>
                            </div>
                          </div>
                        ))}

                        {/* Bouncing Typing Dot Indicator */}
                        {isChatTyping && (
                          <div className="flex justify-start">
                            <div className="bg-white border border-gray-200 rounded-xl rounded-tl-none px-4 py-3 text-xs shadow-xxs flex items-center space-x-1.5">
                              <span className="text-gray-500 font-bold text-[10px] uppercase tracking-wide">Agent is typing</span>
                              <span className="flex space-x-0.5">
                                <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce delay-75" />
                                <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce delay-150" />
                                <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce delay-300" />
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Input Form Box */}
                    <form onSubmit={handleSendChatMessage} className="bg-white p-2 md:p-3 border-t border-gray-200 flex items-center space-x-1.5 md:space-x-2">
                      <button
                        type="button"
                        onClick={triggerUserImageAttach}
                        title="Upload proof screenshot"
                        className="p-2 border border-gray-300 hover:bg-gray-50 rounded-xl text-gray-500 hover:text-gray-700 transition cursor-pointer flex-shrink-0"
                      >
                        <Paperclip className="h-4 w-4" />
                      </button>
                      <input
                        type="file"
                        id="userImageAttachInput"
                        accept="image/*"
                        className="hidden"
                        onChange={handleUserImageUpload}
                      />

                      <input
                        type="text"
                        value={chatInputText}
                        onChange={(e) => setChatInputText(e.target.value)}
                        placeholder="Ask support about deposits, task locks, or payouts..."
                        className="flex-1 px-3 py-2 md:px-4 md:py-2.5 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-amazon-gold font-medium text-gray-800"
                      />
                      <button
                        type="submit"
                        disabled={!chatInputText.trim()}
                        className="p-2 md:p-2.5 bg-[#F7CA00] hover:bg-[#E2B600] disabled:bg-gray-100 text-amazon-dark disabled:text-gray-400 border border-[#a88734] disabled:border-gray-200 rounded-xl transition cursor-pointer flex-shrink-0"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </form>

                    {/* Browser Session Note */}
                    <div className="bg-gray-100 border-t border-gray-200 px-4 py-2 text-[9px] text-gray-500 italic text-center font-medium font-sans">
                      Note: Support chat transcripts are securely archived on remote synchronization channels.
                    </div>
                  </div>

                  {/* Right Column: Telegram link & Notices */}
                  <div className="lg:col-span-4 space-y-6">
                    {/* Telegram support block */}
                    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 shadow-xs text-center">
                      <div className="h-12 w-12 bg-[#0088cc]/10 rounded-full flex items-center justify-center mx-auto text-[#0088cc] border border-[#0088cc]/20">
                        {/* Telegram Icon SVG */}
                        <svg className="h-5.5 w-5.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.89 1.2-5.33 3.52-.5.35-.96.52-1.37.51-.46-.01-1.35-.26-2.01-.48-.81-.27-1.46-.42-1.4-.89.03-.25.38-.51 1.07-.78 4.2-1.82 7-3.03 8.4-3.61 4-.17 4.83.12 4.74 1.25z" />
                        </svg>
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-black uppercase text-gray-900 tracking-wider">Telegram Live Support</h4>
                        <p className="text-[10px] text-gray-450 leading-relaxed font-sans">
                          Prefer direct chat? Click below to speak with an operator on our verified Telegram customer service channel.
                        </p>
                      </div>
                      <a
                        href={telegramSupportLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full py-2.5 bg-[#0088cc] hover:bg-[#0077b3] text-white font-bold text-xs rounded-xl transition shadow-xs text-center"
                      >
                        Open Telegram Support
                      </a>
                    </div>

                    {/* Important notices */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start space-x-3 text-amber-800">
                      <ShieldAlert className="h-5 w-5 flex-shrink-0 mt-0.5 text-amber-600" />
                      <div className="text-xs leading-relaxed font-medium">
                        <strong className="text-amber-900 font-bold">Client Protocol Security:</strong>
                        <p className="mt-0.5 text-amber-700 font-sans">
                          Never share account security passwords or withdrawal PINs with any live agent or node validator. All balance synchronization is automated.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================================== ABOUT US ================================== */}
            {activeTab === 'about-us' && (
              <div className="space-y-6 animate-fadeIn text-left max-w-3xl">
                <div>
                  <h2 className="text-lg font-black text-gray-900">About Amazon E-Commerce Hub</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Learn about our mission and how we connect reviewers with leading e-commerce merchants.
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6 md:p-8 space-y-6 shadow-xs text-xs text-gray-600 leading-relaxed">
                  <div className="flex items-center space-x-3 pb-4 border-b border-gray-100">
                    <div className="h-12 w-12 bg-[#131921] rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-amazon-gold font-black text-lg font-mono">A</span>
                    </div>
                    <div>
                      <h3 className="text-base font-black text-gray-900">Amazon E-Commerce Hub</h3>
                      <p className="text-[10px] text-gray-400 mt-0.5 font-mono">amazonecommercehub.com</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-black text-gray-900 uppercase">Our Mission</h4>
                    <p>
                      Amazon E-Commerce Hub is a decentralized review platform that bridges independent evaluators with global merchants across Amazon, Alibaba, and Shopify ecosystems. Our platform ensures authentic product reviews while rewarding contributors fairly.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-black text-gray-900 uppercase">How We Work</h4>
                    <p>
                      Users deposit collateral funds via cryptocurrency, receive assigned product evaluation tasks, and earn commissions (4%–12%) for each verified review. All transactions are fully decentralized via blockchain, ensuring transparency and security.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-black text-gray-900 uppercase">VIP Program</h4>
                    <p>
                      Our tiered VIP system rewards dedicated reviewers with higher commission rates. VIP 1 (Amazon) offers 4% commission, VIP 2 (Alibaba) offers 8%, and VIP 3 (Shopify) offers up to 12% commission on every completed review task.
                    </p>
                  </div>

                  <div className="border-t border-gray-100 pt-4 text-center text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    Amazon E-Commerce Hub © 2026 · All Rights Reserved · amazonecommercehub.com
                  </div>
                </div>
              </div>
            )}

            {/* DELETED OLD SETTINGS BLOCK — replaced with about-us above */}
            {false && (
              <div className="space-y-6 animate-fadeIn text-left">
                <div className="max-w-2xl">
                  <h2 className="text-lg font-black text-gray-900">Portal Security & Configuration</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Manage system parameters, wallet destination keys, and interface notification channels.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                  {/* Left Column: Sub-Tab Buttons */}
                  <div className="lg:col-span-3 space-y-1.5">
                    {([
                      { id: 'account', label: 'Account Profile', icon: User },
                      { id: 'notifications', label: 'Alert Preferences', icon: Bell },
                      { id: 'wallet', label: 'Payout Wallets', icon: Wallet },
                      { id: 'danger', label: 'Danger Zone', icon: ShieldAlert }
                    ] as const).map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => setSettingsSubTab(sub.id)}
                        className={`w-full flex items-center space-x-2.5 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all text-left ${settingsSubTab === sub.id
                          ? 'bg-[#131921] text-white font-black'
                          : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                          }`}
                      >
                        <sub.icon className="h-4 w-4 flex-shrink-0" />
                        <span>{sub.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Right Column: Interactive Sub-Tab Content */}
                  <div className="lg:col-span-9 bg-white rounded-xl border border-gray-200 p-6 shadow-xs min-h-[320px]">

                    {/* Sub-tab: Account Profile */}
                    {settingsSubTab === 'account' && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (isSavingSettings) return;
                          setIsSavingSettings(true);
                          setTimeout(() => {
                            showToast("Security credentials updated successfully!");
                            setIsSavingSettings(false);
                          }, 500);
                        }}
                        className="space-y-4 animate-fadeIn"
                      >
                        <h3 className="text-sm font-black text-gray-900 border-b border-gray-100 pb-2.5">Security Credentials</h3>

                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase font-black">Username Profile Identifier</label>
                          <input
                            type="text"
                            required
                            value={settingsUsername}
                            onChange={(e) => setSettingsUsername(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold font-bold text-gray-800"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase font-black">Registered Email</label>
                          <input
                            type="email"
                            required
                            value={settingsEmail}
                            onChange={(e) => setSettingsEmail(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold font-medium text-gray-700"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase font-black">Change Security Password</label>
                          <input
                            type="password"
                            placeholder="Enter new account password"
                            value={settingsPassword}
                            onChange={(e) => setSettingsPassword(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold"
                          />
                          <p className="text-[9px] text-gray-400">Leave empty to retain existing security password key.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2">
                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 uppercase font-black">Language Preference</label>
                            <select
                              value={settingsLanguage}
                              onChange={(e) => setSettingsLanguage(e.target.value)}
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-gray-800 focus:outline-none"
                            >
                              <option value="English">English (US)</option>
                              <option value="Spanish">Español</option>
                              <option value="Mandarin">普通话</option>
                              <option value="Hindi">हिन्दी</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 uppercase font-black">System Timezone</label>
                            <select
                              value={settingsTimezone}
                              onChange={(e) => setSettingsTimezone(e.target.value)}
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-gray-800 focus:outline-none"
                            >
                              <option value="UTC+5">UTC+5 (Pakistan Standard)</option>
                              <option value="UTC+0">UTC (Universal Coordinated)</option>
                              <option value="EST">EST (Eastern Standard)</option>
                            </select>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isSavingSettings}
                          className="px-5 py-2.5 bg-[#131921] hover:bg-black disabled:bg-gray-400 text-white text-xs font-bold rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed"
                        >
                          {isSavingSettings ? (
                            <span className="flex items-center">
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Updating...
                            </span>
                          ) : (
                            'Update Profile Credentials'
                          )}
                        </button>
                      </form>
                    )}

                    {/* Sub-tab: Notifications */}
                    {settingsSubTab === 'notifications' && (
                      <div className="space-y-5 animate-fadeIn">
                        <h3 className="text-sm font-black text-gray-900 border-b border-gray-100 pb-2.5">Alert & Hook Notification Channels</h3>
                        <p className="text-xs text-gray-500">Configure real-time hooks to capture merchant order matches instantly.</p>

                        <div className="space-y-4 pt-1">
                          <label className="flex items-start space-x-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={emailNotifToggle}
                              onChange={(e) => setEmailNotifToggle(e.target.checked)}
                              className="mt-1 h-4 w-4 rounded border-gray-300 text-amazon-gold focus:ring-amazon-gold"
                            />
                            <div className="text-xs space-y-0.5">
                              <span className="font-bold text-gray-800 block">Email Report Digests</span>
                              <span className="text-gray-400 block">Receive daily commission breakdown statements and payout confirmations.</span>
                            </div>
                          </label>

                          <label className="flex items-start space-x-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={browserNotifToggle}
                              onChange={(e) => setBrowserNotifToggle(e.target.checked)}
                              className="mt-1 h-4 w-4 rounded border-gray-300 text-amazon-gold focus:ring-amazon-gold"
                            />
                            <div className="text-xs space-y-0.5">
                              <span className="font-bold text-gray-800 block">In-App Browser Desktop Alerts</span>
                              <span className="text-gray-400 block">Ping audio alert tones immediately when compliance check tasks are assigned.</span>
                            </div>
                          </label>

                          <label className="flex items-start space-x-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={telegramNotifToggle}
                              onChange={(e) => setTelegramNotifToggle(e.target.checked)}
                              className="mt-1 h-4 w-4 rounded border-gray-300 text-amazon-gold focus:ring-amazon-gold"
                            />
                            <div className="text-xs space-y-0.5">
                              <span className="font-bold text-gray-800 block">Secure Telegram Bot Hook</span>
                              <span className="text-gray-400 block">Push order verification compliance checks and ledger audits to your chat channel.</span>
                            </div>
                          </label>
                        </div>

                        <button
                          onClick={() => {
                            if (isSavingAlerts) return;
                            setIsSavingAlerts(true);
                            setTimeout(() => {
                              showToast("Alert configurations synchronized!");
                              setIsSavingAlerts(false);
                            }, 500);
                          }}
                          disabled={isSavingAlerts}
                          className="px-5 py-2.5 bg-[#131921] hover:bg-black disabled:bg-gray-400 text-white text-xs font-bold rounded-lg transition-all cursor-pointer mt-4 disabled:cursor-not-allowed"
                        >
                          {isSavingAlerts ? (
                            <span className="flex items-center">
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Saving...
                            </span>
                          ) : (
                            'Save Alert Preferences'
                          )}
                        </button>
                      </div>
                    )}

                    {/* Sub-tab: Payout Wallets */}
                    {settingsSubTab === 'wallet' && (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (isAddressBound) return;
                          if (isBindingWallet) return;
                          if (!defaultWalletAddress.trim()) {
                            showToast("Wallet address cannot be empty.");
                            return;
                          }
                          setIsBindingWallet(true);
                          try {
                            const token = localStorage.getItem('reviewer_auth_token');
                            const res = await fetch(`${API_BASE}/auth/bind-usdt`, {
                              method: 'PUT',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                              },
                              body: JSON.stringify({ address: defaultWalletAddress })
                            });
                            const data = await res.json();
                            if (res.ok) {
                              showToast("✓ USDT withdrawal address successfully bound and locked!");
                              fetchAllData();
                            } else {
                              showToast(data.error || "Failed to bind wallet address.");
                            }
                          } catch (err) {
                            showToast("Connection error binding address.");
                          } finally {
                            setIsBindingWallet(false);
                          }
                        }}
                        className="space-y-4 animate-fadeIn"
                      >
                        <h3 className="text-sm font-black text-gray-900 border-b border-gray-100 pb-2.5">USDT Payout Destination Wallet</h3>

                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase font-black">Release Network</label>
                          <select
                            value={defaultNetwork}
                            onChange={(e) => setDefaultNetwork(e.target.value)}
                            disabled={isAddressBound}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-gray-800 focus:outline-none disabled:opacity-60"
                          >
                            <option value="TRC-20">TRC-20 Network (Tron Smart Contract)</option>
                            <option value="ERC-20">ERC-20 Network (Ethereum Virtual Machine)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase font-black">Your Permanent TRC20 Destination Address</label>
                          <input
                            type="text"
                            required
                            disabled={isAddressBound}
                            placeholder="Enter your USDT wallet address (e.g. T..."
                            value={defaultWalletAddress}
                            onChange={(e) => setDefaultWalletAddress(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold font-mono text-gray-800 disabled:bg-gray-100 disabled:opacity-80"
                          />
                          <p className="text-[9px] text-gray-400 leading-normal">
                            {isAddressBound
                              ? "🔒 This payout destination address is bound and locked. Contact support to request adjustments."
                              : "⚠️ Ensure correctness! Once locked, all future simulated withdrawals will propagate exclusively to this coordinate."}
                          </p>
                        </div>

                        {!isAddressBound && (
                          <button
                            type="submit"
                            disabled={isBindingWallet}
                            className="px-5 py-2.5 bg-[#131921] hover:bg-black disabled:bg-gray-400 text-white text-xs font-bold rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed"
                          >
                            {isBindingWallet ? (
                              <span className="flex items-center">
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Locking...
                              </span>
                            ) : (
                              'Lock Wallet Coordinates'
                            )}
                          </button>
                        )}
                      </form>
                    )}

                    {/* Sub-tab: Danger Zone */}
                    {settingsSubTab === 'danger' && (
                      <div className="space-y-5 animate-fadeIn text-left">
                        <h3 className="text-sm font-black text-red-600 border-b border-red-100 pb-2.5">Sensitive Danger Operations</h3>

                        <div className="bg-red-50 border border-red-200 rounded-xl p-4.5 text-red-800 text-xs leading-relaxed space-y-1">
                          <strong className="font-bold text-red-950 block">⚠️ Security Audit Warning</strong>
                          <span className="block text-red-700">
                            Resetting workspace data wipes completed e-commerce orders history and balances. Deleted profile accounts cannot be easily reinstated.
                          </span>
                        </div>

                        <div className="pt-2 space-y-3">
                          <button
                            onClick={() => {
                              if (window.confirm("Restore factory database defaults? All order history counts will be reset to compliance base.")) {
                                setPlatformsData({
                                  Amazon: {
                                    walletBalance: 16.45, completedOrders: 14, pendingReviews: 1, profitEarned: 22.85, orders: [
                                      { id: "ord-amz-101", productTitle: "ZonHub Smart Echo (5th Gen)", orderId: "403-9912039-112019", payout: 1.25, status: 'Completed', date: "Jul 08, 2026", reviewText: "Incredible sound quality." },
                                      { id: "ord-amz-102", productTitle: "ZonReader Paperwhite (16 GB)", orderId: "403-1293842-881903", payout: 1.95, status: 'Completed', date: "Jul 06, 2026" },
                                      { id: "ord-amz-103", productTitle: "Bamboo Coasters Set (6-Pack)", orderId: "403-7712394-002931", payout: 0.80, status: 'Pending', date: "Jul 09, 2026" }
                                    ]
                                  },
                                  Alibaba: { walletBalance: 2.10, completedOrders: 2, pendingReviews: 0, profitEarned: 3.50, orders: [] },
                                  Shopify: { walletBalance: 0.00, completedOrders: 0, pendingReviews: 0, profitEarned: 0.00, orders: [] }
                                });
                                showToast("Workspace ledger state factory-reset successfully!");
                              }
                            }}
                            className="px-4 py-2.5 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-black rounded-lg transition-all cursor-pointer"
                          >
                            Reset Compliance Ledger Defaults
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              </div>
            )}

            {/* ================================== FAQ ================================== */}
            {activeTab === 'faq' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <div className="max-w-2xl">
                  <h2 className="text-lg font-black text-gray-900">Tester Help Center & Knowledge Hub</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Lookup quick operational workflows or search compliance guidelines for assigned micro-commission tasks.
                  </p>
                </div>

                {/* FAQ Search Header bar */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search FAQs by keywords..."
                      value={faqSearch}
                      onChange={(e) => setFaqSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold"
                    />
                  </div>
                  {faqSearch && (
                    <button
                      onClick={() => setFaqSearch('')}
                      className="text-xs text-amazon-blue font-bold hover:underline"
                    >
                      Clear Search
                    </button>
                  )}
                </div>

                {/* Accordion List */}
                <div className="space-y-3.5 max-w-3xl pt-2">
                  {([
                    {
                      id: 1,
                      q: "How are evaluation micro-commissions calculated?",
                      a: "Each assigned product campaign has a fixed payout Commission set by the registered third-party merchant. These payments are bounded between $0.50 and $2.50 to remain within e-commerce compliant guidelines."
                    },
                    {
                      id: 2,
                      q: "Why is there a strict 25 completed orders cashout threshold?",
                      a: "Merchants batch audit reviewer compliance profiles to avoid fraud. Once you successfully record 25 completed reviews inside the active network ledger, the secure smart contract releases your Available Balance automatically."
                    },
                    {
                      id: 3,
                      q: "What occurs if my submitted Order ID gets rejected?",
                      a: "E-commerce APIs match recorded numbers automatically. If a discrepancy exists, the audit statuses switch to Failed. Re-verify the alphanumeric digit chain on your receipt and update the ID inside the Orders log."
                    },
                    {
                      id: 4,
                      q: "How do I secure and confirm crypto deposit transactions?",
                      a: "Each user accounts for a private cryptographic deposit key. When sending USDT, allow up to 5 minutes for Tron/Ethereum block confirmations before clicking 'Sync Balance' inside your dashboard panel."
                    },
                    {
                      id: 5,
                      q: "Why can I not start a new batch immediately after completing 25 orders?",
                      a: "To maintain system integrity, a 24-hour cooldown period starts as soon as your withdrawal request is approved by the administrator. The platform will unlock the next campaign pool automatically once this timer expires."
                    },
                    {
                      id: 6,
                      q: "Can I change my bound USDT withdrawal address?",
                      a: "No, once a USDT address is bound to your account, it is locked permanently for security purposes. This protocol ensures that your earnings cannot be hijacked or redirected to another destination."
                    },
                    {
                      id: 7,
                      q: "What happens to my order progress if I stop midway through a batch?",
                      a: "Your progress is permanently frozen. If you stop at order 15 of 25, your progress will remain at 15 indefinitely until you return to complete the remaining reviews. There are no automatic resets for partial batches."
                    },
                    {
                      id: 8,
                      q: "Can I review the same product multiple times in a single batch?",
                      a: "No. To comply with authentic review guidelines, you cannot submit multiple reviews for the same product in a single 25-order batch. Each campaign must represent a unique product evaluation."
                    }
                  ] as const)
                    .filter(item =>
                      item.q.toLowerCase().includes(faqSearch.toLowerCase()) ||
                      item.a.toLowerCase().includes(faqSearch.toLowerCase())
                    )
                    .map((item) => {
                      const isOpen = activeFaqId === item.id;
                      return (
                        <div
                          key={item.id}
                          className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-all duration-200 shadow-xxs"
                        >
                          <button
                            onClick={() => setActiveFaqId(isOpen ? null : item.id)}
                            className="w-full px-5 py-4 flex items-center justify-between text-left focus:outline-none cursor-pointer"
                          >
                            <span className="text-xs font-black text-gray-900">{item.q}</span>
                            <span className="text-gray-400 font-bold text-sm ml-4">
                              {isOpen ? '−' : '+'}
                            </span>
                          </button>

                          {isOpen && (
                            <div className="px-5 pb-4 text-xs text-gray-600 leading-relaxed border-t border-gray-100 pt-3 bg-gray-50/50">
                              {item.a}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* ================================== TERMS & ABOUT ================================== */}
            {activeTab === 'terms' && (
              <div className="space-y-6 animate-fadeIn text-left max-w-3xl">
                <div>
                  <h2 className="text-lg font-black text-gray-900">E-Commerce Compliance Standing Protocol</h2>
                  <p className="text-xs text-gray-500 mt-1">Review operational guidelines and anti-shilling reviewer agreements.</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6 md:p-8 space-y-6 shadow-xs leading-relaxed text-xs text-gray-600">
                  <div className="space-y-2">
                    <h3 className="text-sm font-black text-gray-900 uppercase">1. Objective Product Evaluations</h3>
                    <p>
                      Independent reviewer participants are strictly mandated to supply real, honest evaluations. We do not support, incentivize, or tolerate fake, misleading, or paid shilling content designed to manipulate market rankings artificially.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-black text-gray-900 uppercase">2. Transient Ledger Collateral</h3>
                    <p>
                      To prevent systemic empty cart checkouts, testers must cover the initial retail pricing of evaluated goods as temporarily held contract collateral. Ledger entries match specific cryptographically signed wallets.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-black text-gray-900 uppercase">3. Sybil & Verification Audits</h3>
                    <p>
                      Reviewers must maintain active verified compliance standing. Multiple duplicate accounts linked to identical TRC-20 release wallets will suffer automatic platform suspension, balance confiscation, and blacklist listing.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-black text-gray-900 uppercase">4. Independent Contractor Standing</h3>
                    <p>
                      Participating members function solely as independent digital contractors on-demand. No employer-employee relationship is established, suggested, or maintained with zonreview Hub or associated merchants.
                    </p>
                  </div>

                  <div className="border-t border-gray-100 pt-5 text-center text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    Protocol Version: 2026.04.11-SECURE
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Dashboard Footer */}
          <footer className="bg-white py-4.5 text-center border-t border-gray-200 mt-12 rounded-xl shadow-xxs">
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
              © 2026 zonreview Evaluation Hub • Secure E-commerce Validation Console
            </p>
          </footer>

        </main>
      </div>

      {/* ================================== MODAL: VERIFIED COMPLIANCE REVIEW PROGRESS WIZARD ================================== */}
      <AnimatePresence>
        {activeReviewProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveReviewProduct(null)}
              className="fixed inset-0 bg-black"
            />

            {/* Centered Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-2xl w-full z-50 overflow-hidden relative flex flex-col max-h-[90vh] text-left"
            >
              {/* Modal Top Header */}
              <div className="px-4 py-2.5 md:px-6 md:py-4 border-b border-gray-150 flex items-center justify-between bg-gray-50 flex-shrink-0">
                <div>
                  <h3 className="text-xs md:text-sm font-black text-gray-900 flex items-center space-x-2">
                    <span className="bg-[#131921] text-white font-mono text-[9px] px-2 py-0.5 rounded tracking-wider uppercase">{activePlatform} Campaign</span>
                  </h3>
                </div>
                <button
                  onClick={() => setActiveReviewProduct(null)}
                  className="p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-black transition"
                >
                  <X className="h-4.5 w-4.5 md:h-5 md:w-5" />
                </button>
              </div>

              {/* Modal Body / Scrollable Content */}
              <div className="p-4 md:p-6 overflow-y-auto space-y-4 md:space-y-5 flex-1">

                {/* Product Details Section */}
                <div className="flex items-center space-x-3 bg-gray-50 p-2.5 md:p-4 rounded-xl border border-gray-150 flex-shrink-0">
                  <img src={activeReviewProduct.image} alt={activeReviewProduct.title} className="h-10 w-10 md:h-16 md:w-16 object-contain rounded border border-gray-200 bg-white p-0.5 flex-shrink-0" />
                  <div className="space-y-0.5 min-w-0">
                    <h4 className="text-[10px] md:text-xs font-black text-gray-900 leading-snug truncate md:whitespace-normal" title={activeReviewProduct.title}>{activeReviewProduct.title}</h4>
                    <div className="flex space-x-3 md:space-x-4 text-[9px] md:text-[10px] text-gray-400 font-bold">
                      <span>Price: <strong className="text-gray-800">${parseFloat(activeReviewProduct.price as any).toFixed(2)}</strong></span>
                      <span>Commission: <strong className="text-green-600">${activeReviewProduct.payout.toFixed(2)} USD</strong></span>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleStep3Complete} className="space-y-4 md:space-y-5">
                  {/* Step 1: Star Rating */}
                  <div className="flex flex-row items-center justify-between md:flex-col md:items-start md:space-y-2 py-1 md:py-0 border-b border-gray-100 md:border-0 pb-2.5 md:pb-0">
                    <label className="text-[10px] md:text-xs font-black text-gray-800 uppercase tracking-wide flex items-center space-x-1.5 flex-shrink-0">
                      <span className="h-4 w-4 md:h-4.5 md:w-4.5 bg-[#131921] text-white text-[9px] md:text-[10px] rounded-full flex items-center justify-center font-bold">1</span>
                      <span>Select Rating</span>
                    </label>
                    <div className="flex space-x-1 md:space-x-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          type="button"
                          key={star}
                          onClick={() => setReviewStars(star)}
                          className="focus:outline-none focus:ring-0 p-0.5 hover:scale-110 transition-transform cursor-pointer"
                        >
                          <Star className={`h-6 w-6 md:h-7 md:w-7 ${star <= reviewStars ? 'fill-amazon-gold text-amazon-gold' : 'text-gray-300'}`} />
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-400 font-medium hidden md:block">Choose a star rating for this product campaign.</p>
                  </div>

                  {/* Step 2: Feedback Templates Selection */}
                  <div className="space-y-2 md:space-y-2.5">
                    <label className="text-[10px] md:text-xs font-black text-gray-800 uppercase tracking-wide flex items-center space-x-1.5">
                      <span className="h-4 w-4 md:h-4.5 md:w-4.5 bg-[#131921] text-white text-[9px] md:text-[10px] rounded-full flex items-center justify-center font-bold">2</span>
                      <span>Choose Feedback Template</span>
                    </label>

                    {/* Mobile dropdown select list */}
                    <div className="block md:hidden">
                      <select
                        value={selectedTextCode || ''}
                        onChange={(e) => setSelectedTextCode(e.target.value ? e.target.value : null)}
                        className="w-full p-2.5 text-xs bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-amazon-gold font-medium text-gray-800"
                      >
                        <option value="01">Quality & Packaging</option>
                        <option value="02">Performance & Build</option>
                        <option value="03">Value & Support</option>
                      </select>
                      {selectedTextCode && (
                        <div className="mt-2 p-2.5 bg-[#fcf8e3]/45 border border-amazon-gold/30 rounded-lg text-[10px] text-gray-700 italic leading-relaxed">
                          "{selectedTextCode === '01' ? "Excellent product quality, fast delivery, and premium packaging. Highly satisfied!" :
                            selectedTextCode === '02' ? "Works exactly as described. Reliable performance and durable build. Would recommend!" :
                              "Great value for money. Very easy setup and outstanding customer support."}"
                        </div>
                      )}
                    </div>

                    {/* Desktop options view */}
                    <div className="hidden md:grid grid-cols-1 gap-2.5">
                      {[
                        { code: '01', text: "Excellent product quality, fast delivery, and premium packaging. Highly satisfied!" },
                        { code: '02', text: "Works exactly as described. Reliable performance and durable build. Would recommend!" },
                        { code: '03', text: "Great value for money. Very easy setup and outstanding customer support." }
                      ].map((opt) => {
                        const isSelected = selectedTextCode === opt.code;
                        return (
                          <button
                            type="button"
                            key={opt.code}
                            onClick={() => setSelectedTextCode(opt.code)}
                            className={`w-full p-3.5 text-left text-xs rounded-xl border transition-all cursor-pointer flex items-start space-x-3 ${isSelected
                              ? 'bg-[#fcf8e3] border-amazon-gold shadow-xxs ring-1 ring-amazon-gold text-gray-900 font-semibold'
                              : 'bg-white border-gray-200 hover:border-gray-300 text-gray-655 font-medium'
                              }`}
                          >
                            <div className={`mt-0.5 h-4 w-4 rounded-full border flex-shrink-0 flex items-center justify-center ${isSelected ? 'border-amazon-gold bg-amazon-gold text-amazon-dark' : 'border-gray-300 bg-white'
                              }`}>
                              {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-[#131921]" />}
                            </div>
                            <span className="leading-relaxed">{opt.text}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-1.5 md:pt-2">
                    <button
                      type="submit"
                      disabled={reviewStars === 0 || selectedTextCode === null || isSubmittingReview || currentPlatformData.completedOrders >= assignedProducts.length}
                      className="w-full py-2.5 md:py-3 bg-amazon-gold hover:bg-[#e2b600] disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 border-0 text-amazon-dark disabled:cursor-not-allowed font-black text-xs rounded-lg transition-colors cursor-pointer text-center uppercase tracking-wider flex items-center justify-center space-x-2"
                    >
                      {isSubmittingReview ? (
                        <>
                          <div className="h-4.5 w-4.5 border-2 border-amazon-dark border-t-transparent rounded-full animate-spin"></div>
                          <span>Verifying & Submitting...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit and Open Next Order</span>
                          <span className="bg-amazon-dark/10 px-2 py-0.5 rounded text-[10px] font-mono">
                            {currentPlatformData.completedOrders + 1}/{assignedProducts.length}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================================== MODAL: SECURE CASHOUT WITHDRAWAL FORM ================================== */}
      <AnimatePresence>
        {isWithdrawOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsWithdrawOpen(false)}
              className="fixed inset-0 bg-black"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-2xl border border-gray-200 p-6 sm:p-8 max-w-sm w-full z-50 relative text-left"
            >
              <button
                onClick={() => setIsWithdrawOpen(false)}
                className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-gray-100 transition text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="text-center mb-6">
                <div className="h-12 w-12 bg-green-50 rounded-full flex items-center justify-center text-green-600 mx-auto border border-green-200">
                  <DollarSign className="h-6 w-6" />
                </div>
                <h3 className="text-base font-black mt-3 text-gray-900">Authorize Wallet Cashout</h3>
                <p className="text-xs text-gray-500 mt-1">Available {activePlatform} wallet balance: <strong>${currentPlatformData.walletBalance.toFixed(2)}</strong></p>
              </div>

              <form onSubmit={handleWithdrawRequest} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Withdrawal Payout Amount ($)</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="1.00"
                    max={currentPlatformData.walletBalance}
                    placeholder="Enter amount to release"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold text-gray-900 font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">USDT (TRC-20) Destination Address</label>
                  <input
                    type="text"
                    required
                    disabled={isAddressBound}
                    placeholder={isAddressBound ? "No address bound" : "Input TRC-20 network address"}
                    value={withdrawAddress}
                    onChange={(e) => setWithdrawAddress(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold text-gray-900 font-mono disabled:bg-gray-100 disabled:opacity-80"
                  />
                  <p className="text-[10px] text-gray-400 mt-1 leading-normal">
                    {isAddressBound
                      ? "🔒 Payouts are routed directly to your bound destination coordinates."
                      : "⚠️ Warning: You must bind your USDT address in Settings before you can withdraw."}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!isAddressBound || isSubmittingWithdraw}
                  className="w-full bg-[#131921] hover:bg-black text-white font-black text-xs py-3 rounded-lg shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingWithdraw ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    isAddressBound ? "Confirm Secure Cashout Release" : "Please Bind Address First"
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================================== MODAL: COMBO POINT TOP-UP REQUIRED ================================== */}
      <AnimatePresence>
        {isComboModalOpen && comboModalDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsComboModalOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl border border-yellow-250 p-6 sm:p-8 max-w-md w-full z-50 relative text-left"
            >
              <button
                onClick={() => setIsComboModalOpen(false)}
                className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-gray-100 transition text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="text-center mb-6">
                <div className="h-16 w-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 mx-auto border border-amber-250 animate-bounce">
                  <ShieldAlert className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-black mt-4 text-gray-900 uppercase tracking-tight">Special Combo Order Locked!</h3>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  Congratulations! You have triggered a high-yield <strong>Special Combo Review (Order #{comboModalDetails.position})</strong>.
                  To process this high-commission order, your wallet balance must meet the merchant requirement.
                </p>
              </div>

              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-3 text-xs">
                {/* Top: Position / Product Details */}
                <div className="flex justify-between items-center pb-2 border-b border-amber-200/50">
                  <span className="text-gray-655 font-bold">Combo Target:</span>
                  <span className="font-mono font-black text-gray-900 uppercase">Order #{comboModalDetails.position}</span>
                </div>
                {/* Middle: Combo Profit */}
                <div className="flex justify-between items-center pb-2 border-b border-amber-200/50">
                  <span className="text-gray-655 font-bold text-green-700 font-sans">Combo Profit Bonus:</span>
                  <span className="font-mono font-black text-green-700 font-bold">+${comboModalDetails.profitAmount.toFixed(2)}</span>
                </div>
                {/* Bottom: Available Balance */}
                <div className="flex justify-between items-center pb-2 border-b border-amber-200/50">
                  <span className="text-gray-655 font-bold">Your Available Balance:</span>
                  <span className="font-mono font-black text-gray-900">${comboModalDetails.currentBalance.toFixed(2)}</span>
                </div>
                {/* Top-up details */}
                <div className="flex justify-between items-center pt-1 font-bold">
                  <span className="text-red-750 font-black">Required Deposit Amount:</span>
                  <span className="font-mono font-extrabold text-red-650 text-sm font-black">${comboModalDetails.triggerBalance.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <button
                  onClick={() => {
                    setIsComboDeposit(true);
                    setComboDepositAmount(comboModalDetails.triggerBalance);
                    setNewDepositAmount(comboModalDetails.triggerBalance.toString());
                    setNewDepositRemark(`Combo Payment for Position ${comboModalDetails.position}`);
                    setIsComboModalOpen(false);
                    setActiveTab('deposit');
                  }}
                  className="w-full bg-[#FF9900] hover:bg-[#e68a00] text-white font-black text-xs py-3.5 rounded-xl shadow-md transition text-center uppercase tracking-wider cursor-pointer font-sans"
                >
                  Deposit & Complete Order Now
                </button>
                <button
                  onClick={() => setIsComboModalOpen(false)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs py-3 rounded-xl transition text-center uppercase cursor-pointer"
                >
                  Cancel & Go Back
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================================== MODAL: COMBO SUCCESS CONGRATULATIONS ================================== */}
      <AnimatePresence>
        {isComboSuccessModalOpen && comboSuccessDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsComboSuccessModalOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl border border-yellow-250 p-6 sm:p-8 max-w-md w-full z-50 relative text-left"
            >
              <button
                onClick={() => setIsComboSuccessModalOpen(false)}
                className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-gray-100 transition text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="text-center mb-6">
                <div className="h-16 w-16 bg-yellow-50 rounded-full flex items-center justify-center text-yellow-600 mx-auto border border-yellow-250 animate-bounce">
                  <span className="text-3xl">🏆</span>
                </div>
                <h3 className="text-lg font-black mt-4 text-gray-900 uppercase tracking-tight">Special Combo Cleared!</h3>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  Congratulations! You cleared the high-commission <strong>Special Combo Review (Order #{comboSuccessDetails.position})</strong> successfully.
                  The merchant reward and profit bonus has been credited to your wallet balance.
                </p>
              </div>

              <div className="bg-yellow-50/70 border border-yellow-200 rounded-xl p-4 space-y-3 text-xs">
                {/* Top: Combo Deposit */}
                <div className="flex justify-between items-center pb-2 border-b border-yellow-200/50">
                  <span className="text-gray-655 font-bold">Combo Deposit:</span>
                  <span className="font-mono font-black text-gray-900">${comboSuccessDetails.checkpointAmount.toFixed(2)}</span>
                </div>
                {/* Middle: Profit Bonus */}
                <div className="flex justify-between items-center pb-2 border-b border-yellow-200/50">
                  <span className="text-gray-655 font-bold text-amber-700 font-sans">Profit Bonus:</span>
                  <span className="font-mono font-black text-amber-700">${comboSuccessDetails.profitBonus.toFixed(2)}</span>
                </div>
                {/* Middle: Previous Balance */}
                <div className="flex justify-between items-center pb-2 border-b border-yellow-200/50">
                  <span className="text-gray-655 font-bold text-gray-500 font-sans">Previous Balance:</span>
                  <span className="font-mono font-bold text-gray-550">${(currentPlatformData.walletBalance - comboSuccessDetails.checkpointAmount - comboSuccessDetails.profitBonus).toFixed(2)} USD</span>
                </div>
                {/* Bottom: Total Available Balance */}
                <div className="flex justify-between items-center pt-1 font-bold">
                  <span className="text-emerald-800 font-extrabold font-sans">Total Available Balance:</span>
                  <span className="font-mono font-black text-emerald-600 text-sm">${currentPlatformData.walletBalance.toFixed(2)} USD</span>
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={() => { setIsComboSuccessModalOpen(false); setActiveTab('orders'); }}
                  className="w-full bg-[#FF9900] hover:bg-[#e68a00] text-white font-black text-xs py-3.5 rounded-xl shadow-md transition text-center uppercase tracking-wider cursor-pointer font-sans"
                >
                  Awesome, Let's Continue!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================================== MODAL: ORDER DETAILS MODAL ================================== */}
      <AnimatePresence>
        {selectedOrderDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrderDetail(null)}
              className="fixed inset-0 bg-black"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-2xl border border-gray-200 p-6 max-w-md w-full z-50 relative text-left"
            >
              <button
                onClick={() => setSelectedOrderDetail(null)}
                className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-gray-100 transition text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="space-y-4">
                <div className="border-b border-gray-100 pb-3">
                  <span className="bg-[#131921] text-white font-mono text-[9px] px-2 py-0.5 rounded tracking-wider uppercase">
                    {activePlatform} Ledger
                  </span>
                  <h3 className="text-sm font-black text-gray-900 mt-1 flex items-center justify-between">
                    <span>Transaction Details</span>
                    <span className="font-mono text-[11px] text-gray-400 font-bold">{selectedOrderDetail.id}</span>
                  </h3>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-black">Merchant Item</label>
                    <p className="text-xs font-bold text-gray-900 mt-0.5 leading-snug">{selectedOrderDetail.productTitle}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase font-black">Order ID Reference</label>
                      <p className="text-xs font-mono font-bold text-gray-800 mt-0.5">{selectedOrderDetail.orderId || 'Pending Input'}</p>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase font-black">Record Date</label>
                      <p className="text-xs font-bold text-gray-700 mt-0.5">{selectedOrderDetail.date}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase font-black">Evaluation Reward</label>
                      <p className="text-sm font-mono font-black text-green-600 mt-0.5">+${selectedOrderDetail.payout.toFixed(2)} USD</p>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase font-black">Standing Status</label>
                      <div className="mt-1">
                        <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded border ${selectedOrderDetail.status === 'Completed'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                          {selectedOrderDetail.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedOrderDetail.status === 'Completed' && (
                    <div className="border-t border-gray-100 pt-3">
                      <label className="text-[10px] text-gray-400 uppercase font-black">Star Rating Compliance</label>
                      <div className="flex space-x-0.5 mt-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className="h-4 w-4 fill-amazon-gold text-amazon-gold" />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-gray-100 pt-3">
                    <label className="text-[10px] text-gray-400 uppercase font-black">Evaluation Feedback Opinion</label>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-150 text-xs text-gray-600 leading-relaxed italic mt-1">
                      {selectedOrderDetail.reviewText || "Compliance verification checks completed. Product opinion validated successfully."}
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-3 space-y-2">
                    <label className="text-[10px] text-gray-400 uppercase font-black">E-Commerce Audit Log</label>
                    <div className="space-y-1.5 font-mono text-[9px] font-bold text-gray-500">
                      <div className="flex items-center space-x-1.5 text-green-600">
                        <span>✓</span>
                        <span>[DONE] CLIENT ACQUISITION VERIFIED</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-green-600">
                        <span>✓</span>
                        <span>[DONE] ORDER REFERENCE ID MATCHED</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-green-600">
                        <span>✓</span>
                        <span>[DONE] OPINION QUALITY MET WORD REQUIREMENT</span>
                      </div>
                      <div className={`flex items-center space-x-1.5 ${selectedOrderDetail.status === 'Completed' ? 'text-green-600' : 'text-amber-500'}`}>
                        <span>{selectedOrderDetail.status === 'Completed' ? '✓' : '●'}</span>
                        <span>{selectedOrderDetail.status === 'Completed' ? '[DONE] LEDGER REWARD RELEASED' : '[PENDING] MERCHANT AUDIT RELEASE'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <div className="md:hidden bg-white border-t border-gray-200 fixed bottom-0 left-0 right-0 h-16 flex items-center justify-around px-2 z-40 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <button
          onClick={() => {
            setActiveTab('home');
            setIsSidebarCollapsed(true);
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${activeTab === 'home' ? 'text-amazon-orange font-black' : 'text-gray-500 hover:text-gray-800'
            }`}
        >
          <Home className="h-5 w-5" />
          <span className="text-[10px] font-bold mt-0.5">Home</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('deposit');
            setIsSidebarCollapsed(true);
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${activeTab === 'deposit' ? 'text-amazon-orange font-black' : 'text-gray-500 hover:text-gray-800'
            }`}
        >
          <Wallet className="h-5 w-5" />
          <span className="text-[10px] font-bold mt-0.5">Deposit</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('orders');
            setIsSidebarCollapsed(true);
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${activeTab === 'orders' ? 'text-amazon-orange font-black' : 'text-gray-500 hover:text-gray-800'
            }`}
        >
          <FileText className="h-5 w-5" />
          <span className="text-[10px] font-bold mt-0.5">Orders</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('profile');
            setIsSidebarCollapsed(true);
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${activeTab === 'profile' ? 'text-amazon-orange font-black' : 'text-gray-500 hover:text-gray-800'
            }`}
        >
          <User className="h-5 w-5" />
          <span className="text-[10px] font-bold mt-0.5">Profile</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('customer-service');
            setIsSidebarCollapsed(true);
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${activeTab === 'customer-service' ? 'text-amazon-orange font-black' : 'text-gray-500 hover:text-gray-800'
            }`}
        >
          <MessageSquare className="h-5 w-5" />
          <span className="text-[10px] font-bold mt-0.5">Support</span>
        </button>
      </div>

    </div>
  );
}
