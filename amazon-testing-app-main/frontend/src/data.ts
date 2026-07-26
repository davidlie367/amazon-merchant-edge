import { Product, Testimonial, Step, Stat } from './types';

export const mockProducts: Product[] = [
  {
    id: "prod-1",
    title: "ZonHub Smart Echo (5th Gen) | Premium spatial sound with voice assistant",
    price: 99.99,
    rating: 4.8,
    reviewsCount: 12403,
    image: "https://images.unsplash.com/photo-1543512214-318c7553f230?auto=format&fit=crop&q=80&w=600",
    description: "Our best-sounding smart speaker yet. Enjoy rich, vibrant vocals and deep bass in any room. Fully integrated with voice intelligence to control smart devices, stream music, and automate your day.",
    features: [
      "Vibrant high-fidelity sound with custom spatial audio",
      "Built-in temperature & motion sensors",
      "Seamless privacy control with physical mic-off switch",
      "Energy star certified eco-friendly materials"
    ],
    isBestSeller: true,
    isPrime: true,
    payout: 2.80,
    platform: "Amazon"
  },
  {
    id: "prod-2",
    title: "ZonReader Paperwhite (16 GB) | 6.8\" display and adjustable warm light",
    price: 139.99,
    rating: 4.9,
    reviewsCount: 8945,
    image: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&q=80&w=600",
    description: "Now with a 6.8” display and thinner borders, adjustable warm light, up to 10 weeks of battery life, and 20% faster page turns. Built to withstand accidental immersion in water.",
    features: [
      "Flush-front design and 300 ppi glare-free screen",
      "Adjustable screen warmness for day-to-night comfort",
      "IPX8 waterproof rating for beach or bath reading",
      "USB-C fast charging that lasts up to 10 weeks"
    ],
    isBestSeller: true,
    isPrime: true,
    payout: 3.50,
    platform: "Amazon"
  },
  {
    id: "prod-3",
    title: "AliUltra Foldable Electric Scooter | Dual motor, 35 miles long-range battery",
    price: 649.99,
    rating: 4.7,
    reviewsCount: 1530,
    image: "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&q=80&w=600",
    description: "Alibaba's top-rated commuter scooter featuring robust front-rear suspensions, 10-inch honeycombed anti-skid solid tires, and an intelligent regenerative battery braking framework.",
    features: [
      "Supercharged 500W dual brushless motors reaching up to 25mph",
      "Triple suspension shock-absorption for all-terrain safety",
      "Folds flat in under 3 seconds for subway and trunk storage",
      "Dynamic digital console showing speed, gear, and range statistics"
    ],
    isBestSeller: true,
    isPrime: false,
    payout: 4.80,
    platform: "Alibaba"
  },
  {
    id: "prod-4",
    title: "AliVision 4K Native LED Projector | 15,000 Lumens outdoor cinematic display",
    price: 189.99,
    rating: 4.6,
    reviewsCount: 2315,
    image: "https://images.unsplash.com/photo-1535016120720-40c646be5580?auto=format&fit=crop&q=80&w=600",
    description: "Experience absolute backyard and bedroom cinematic luxury. Powered by high-contrast custom optics, built-in dual 10W Dolby speakers, and lightning-fast dual-band Wi-Fi 6 cast streaming.",
    features: [
      "Vibrant 15,000 Lumens display showing rich color contrast",
      "Self-correcting automatic keystone alignment and electric focus",
      "Ultra-silent active cooling fans keeping heat below 30dB",
      "Multi-port interface supporting HDMI, USB, and audio jacks"
    ],
    isBestSeller: false,
    isPrime: false,
    payout: 3.10,
    platform: "Alibaba"
  },
  {
    id: "prod-5",
    title: "Minimalist Full-Grain Leather Wallet | RFID Blocking ultra-thin organizer",
    price: 39.99,
    rating: 4.7,
    reviewsCount: 10420,
    image: "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&q=80&w=600",
    description: "A beautifully hand-stitched slim daily carry wallet made of certified environment-friendly full-grain leather. Built to store up to 12 credit cards and banknotes securely.",
    features: [
      "Certified RFID protection layer preventing electronic scanning theft",
      "Integrated secure brushed-aluminum spring-action money clip",
      "Quick-access slider slot pulling out cards with a simple slide",
      "Ultra-thin layout fitting beautifully in front pockets without bulk"
    ],
    isBestSeller: true,
    isPrime: false,
    payout: 2.50,
    platform: "Shopify"
  },
  {
    id: "prod-6",
    title: "Therapeutic Essential Oils Diffuser | Ceramic ultrasonic humidifying glow",
    price: 45.00,
    rating: 4.5,
    reviewsCount: 1680,
    image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&q=80&w=600",
    description: "A stunning handmade ceramic ultrasonic essential oil diffuser that humidifies dry room air while projecting an ambient warm-gold soothing nightlight loop.",
    features: [
      "Ultra-quiet ultrasonic whisper technology diffusing mist cleanly",
      "Waterless automatic shut-off safeguard preventing dry overheating",
      "Dual continuous and intermittent spray frequency settings",
      "Premium tactile controls styled with natural bamboo wood bases"
    ],
    isBestSeller: false,
    isPrime: false,
    payout: 2.20,
    platform: "Shopify"
  }
];

export const mockTestimonials: Testimonial[] = [
  {
    id: "test-1",
    name: "Sarah Jenkins",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150",
    title: "Earned $124 in my first week reviewing!",
    rating: 5,
    date: "July 2, 2026",
    verified: true,
    location: "United States",
    content: "I was skeptical about earning real cash for writing honest feedback, but Amazon E-Commerce Hub makes it incredibly transparent. I reviewed a paperwhite reader and some Shopify boutique clothes, and withdrew $45 instantly via PayPal. Outstanding side hustle!",
    helpfulCount: 342
  },
  {
    id: "test-2",
    name: "Marcus Chen",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150",
    title: "Highest paying tasks on the internet",
    rating: 5,
    date: "June 28, 2026",
    verified: true,
    location: "Canada",
    content: "The payouts here are genuinely higher than any other micro-task site. I love how they organize review products cleanly into Amazon, Alibaba, and Shopify tabs. I earned $4.80 for my electric scooter review in under five minutes!",
    helpfulCount: 198
  },
  {
    id: "test-3",
    name: "Elena Rostova",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150",
    title: "Payouts are super reliable",
    rating: 5,
    date: "May 15, 2026",
    verified: true,
    location: "United Kingdom",
    content: "I use this platform every day after my morning coffee. Reviewing products helps sellers optimize quality while putting real spending money right back into my pocket. 100% recommended for high-quality English writers.",
    helpfulCount: 87
  }
];

export const steps: Step[] = [
  {
    number: "01",
    title: "Select a Product",
    description: "Browse curated review tasks originating from top retail networks like Amazon, Alibaba, and Shopify. Choose ones matching your interests.",
    iconName: "Search"
  },
  {
    number: "02",
    title: "Write Honest Feedback",
    description: "Test your familiarity or complete custom feedback satisfying the required word limits. We emphasize detailed, helpful reviews.",
    iconName: "Edit3"
  },
  {
    number: "03",
    title: "Get Instant Credit",
    description: "Once submitted, our smart engine checks standard quality benchmarks and credits your ZonWallet immediately with the reward.",
    iconName: "CreditCard"
  },
  {
    number: "04",
    title: "Withdraw Instantly",
    description: "Request a cashout anytime your balance exceeds $10.00. We process automated payouts straight to PayPal, Payoneer, or Stripe.",
    iconName: "Gift"
  }
];

export const stats: Stat[] = [
  {
    value: "$4.2M+",
    numericValue: 4200000,
    label: "Earned by Reviewers",
    description: "Successfully processed and paid out to thousands of global remote writers."
  },
  {
    value: "120K+",
    numericValue: 120000,
    label: "Active Reviewers",
    description: "Providing high-fidelity, comprehensive merchant product feedback daily."
  },
  {
    value: "25K+",
    numericValue: 25000,
    label: "Daily Tasks Completed",
    description: "Across diverse, high-volume segments on major global storefronts."
  },
  {
    value: "$3.20",
    numericValue: 3.20,
    label: "Average Reward",
    description: "Earn consistent micro-income with our standard structured payout rates."
  }
];
