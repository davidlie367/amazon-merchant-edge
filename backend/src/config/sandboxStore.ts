export interface ChatMessage {
  id: string;
  user_id: string;
  sender: 'user' | 'admin';
  text: string;
  time: string;
  created_at: string;
}

export interface Profile {
  id: string;
  username: string;
  email?: string | null;
  phone?: string | null;
  password: string;
  withdrawal_password?: string | null;
  country: string;
  city: string;
  ip_address: string;
  status: 'active' | 'restricted' | 'pending';
  referral_code: string;
  referred_by?: string | null;
  bound_usdt_address?: string | null;
  platform?: string | null;
  profile_photo?: string | null;
  balance: number;
  created_at: string;
}

export interface PlatformBalance {
  id: string;
  user_id: string;
  platform: string;
  wallet_balance: number;
  reviews_count: number;
  current_position: number;
  last_completed_batch_at?: string | null;
  last_reset_at: string;
}

export interface Product {
  id: string;
  title: string;
  image_url: string;
  price: number;
  payout: number;
  external_link?: string;
  created_at: string;
}

export interface UserAssignedProduct {
  id: string;
  user_id: string;
  product_id: string;
  platform: string;
  position: number;
  created_at: string;
}

export interface ComboCheckpoint {
  id: string;
  user_id: string;
  platform: string;
  position: number;
  trigger_balance: number;
  profit_override: number;
  created_at: string;
}

export interface Deposit {
  id: string;
  user_id: string;
  platform: string;
  protocol: string;
  amount: number;
  crypto_amount?: number;
  currency?: string;
  tx_hash: string;
  remark?: string | null;
  ip_address?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  created_at: string;
}

export interface Withdrawal {
  id: string;
  user_id: string;
  platform: string;
  amount: number;
  address: string;
  ip_address?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  created_at: string;
}

export interface ReviewSubmission {
  id: string;
  user_id: string;
  product_id: string;
  order_id: string;
  review_text: string;
  status: 'Completed';
  payout_earned: number;
  platform: string;
  created_at: string;
}

export interface AdminUser {
  id: string;
  username: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  password: string;
  ip_address: string;
  status: 'pending' | 'active' | 'rejected' | 'restricted';
  is_restricted?: boolean;
  created_at: string;
}

// In-Memory Collections
export const mockChatMessages: ChatMessage[] = [
  {
    id: 'greet-default',
    user_id: 'user-dev-uuid',
    sender: 'admin',
    text: 'Hello! Welcome to the Client Support Desk. How can we assist you today?',
    time: 'Just now',
    created_at: new Date().toISOString()
  }
];

export const mockProfiles: Profile[] = [];
export const mockAdmins: AdminUser[] = [
  {
    id: 'admin-dev-001',
    username: 'admin',
    full_name: 'System Admin',
    email: 'admin@amazonvine.com',
    password: 'admin',
    ip_address: '127.0.0.1',
    status: 'active',
    is_restricted: false,
    created_at: new Date().toISOString()
  }
];
export const mockPlatformBalances: PlatformBalance[] = [];
export const mockProducts: Product[] = [];
export const mockUserAssignedProducts: UserAssignedProduct[] = [];
export const mockComboCheckpoints: ComboCheckpoint[] = [];
export const mockDeposits: Deposit[] = [];
export const mockWithdrawals: Withdrawal[] = [];
export const mockReviewSubmissions: ReviewSubmission[] = [];

// Default Product Pool Seeding
export function ensureDefaultProducts() {
  if (mockProducts.length >= 25) return;

  const defaultItems = [
    { title: 'ZonHub Smart Echo (5th Gen) | Spatial sound', image_url: 'https://images.unsplash.com/photo-1543512214-318c7553f230?w=600', price: 31.25, payout: 1.25 },
    { title: 'ZonReader Paperwhite (16 GB) | Warm light', image_url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600', price: 48.75, payout: 1.95 },
    { title: 'Organic Bamboo Coasters Set (6-Pack)', image_url: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=600', price: 20.00, payout: 0.80 },
    { title: 'Ergonomic Memory Foam Seat Cushion', image_url: 'https://images.unsplash.com/photo-1505797149-43b0069ec26b?w=600', price: 27.50, payout: 1.10 },
    { title: 'Stainless Steel Insulated Water Bottle', image_url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600', price: 35.00, payout: 1.40 },
    { title: 'Professional Ionic Hair Dryer 1875W', image_url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600', price: 55.00, payout: 2.20 },
    { title: 'Adjustable Ergonomic Laptop Stand', image_url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600', price: 41.25, payout: 1.65 },
    { title: 'Organic Premium Matcha Powder', image_url: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600', price: 23.75, payout: 0.95 },
    { title: 'Dual USB-C 40W Fast Wall Charger', image_url: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600', price: 26.25, payout: 1.05 },
    { title: 'Wireless ANC Earbuds Bluetooth 5.3', image_url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600', price: 52.50, payout: 2.10 },
    { title: 'Digital Precision Kitchen Scale', image_url: 'https://images.unsplash.com/photo-1588675646184-f550218b57b5?w=600', price: 18.75, payout: 0.75 },
    { title: 'Ceramic Essential Oil Diffuser 500ml', image_url: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600', price: 32.50, payout: 1.30 },
    { title: 'AliUltra Electric Scooter Dual Motor', image_url: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=600', price: 31.25, payout: 2.50 },
    { title: 'AliVision 4K Native LED Projector', image_url: 'https://images.unsplash.com/photo-1535016120720-40c646be5580?w=600', price: 26.87, payout: 2.15 },
    { title: 'AliSecure HD Outdoor IP Camera PTZ', image_url: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=600', price: 22.50, payout: 1.80 },
    { title: 'Smart Automated Robot Vacuum LIDAR', image_url: 'https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?w=600', price: 30.00, payout: 2.40 },
    { title: 'Portable Solar Power Station 500Wh', image_url: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=600', price: 28.75, payout: 2.30 },
    { title: 'Heavy Duty Deep Tissue Massage Gun', image_url: 'https://images.unsplash.com/photo-1607962837359-5e7eaf562642?w=600', price: 20.00, payout: 1.60 },
    { title: 'Adjustable Dumbbells Set Quick Dial', image_url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600', price: 28.12, payout: 2.25 },
    { title: 'Automatic 20 Bar Espresso Machine', image_url: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=600', price: 30.62, payout: 2.45 },
    { title: 'Electric Oral Irrigator Dental Flosser', image_url: 'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=600', price: 11.87, payout: 0.95 },
    { title: 'Bluetooth Thermal Label Printer', image_url: 'https://images.unsplash.com/photo-1543269664-76bc3997d9ea?w=600', price: 15.00, payout: 1.20 },
    { title: 'Car Roof Cargo Carrier Bag Waterproof', image_url: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=600', price: 18.75, payout: 1.50 },
    { title: 'Foldable Photography Studio Lightbox', image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600', price: 18.12, payout: 1.45 },
    { title: 'Minimalist Full-Grain Leather Wallet', image_url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=600', price: 11.00, payout: 1.32 }
  ];

  defaultItems.forEach((item, idx) => {
    mockProducts.push({
      id: `prod-${idx + 1}`,
      title: item.title,
      image_url: item.image_url,
      price: item.price,
      payout: item.payout,
      external_link: 'https://amazon.com',
      created_at: new Date().toISOString()
    });
  });
}
