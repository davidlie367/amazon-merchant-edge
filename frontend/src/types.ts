export interface Product {
  id: string;
  title: string;
  price: number;
  rating: number;
  reviewsCount: number;
  image: string;
  description: string;
  features: string[];
  isBestSeller?: boolean;
  isPrime?: boolean;
  payout: number;
  platform: 'Amazon' | 'Alibaba' | 'Shopify';
}

export interface Testimonial {
  id: string;
  name: string;
  avatar: string;
  title: string;
  rating: number;
  date: string;
  verified: boolean;
  content: string;
  helpfulCount: number;
  location?: string;
}

export interface Step {
  number: string;
  title: string;
  description: string;
  iconName: string;
}

export interface Stat {
  value: string;
  numericValue: number;
  label: string;
  description: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
