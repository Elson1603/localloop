export type MarketplaceItem = {
  id: string;
  title: string;
  category: string;
  price?: number;
  barterAvailable: boolean;
  distanceKm: number;
  location: string;
  image: string;
  description: string;
  seller: {
    name: string;
    rating: number;
    avatar: string;
  };
};

export const categories = [
  { name: "Electronics", icon: "📱" },
  { name: "Books", icon: "📚" },
  { name: "Furniture", icon: "🛋️" },
  { name: "Vehicles", icon: "🚲" },
  { name: "Fashion", icon: "👕" },
  { name: "Home Decor", icon: "🪴" },
];

export const items: MarketplaceItem[] = [
  {
    id: "1",
    title: "iPhone 13 - Excellent Condition",
    category: "Electronics",
    price: 42000,
    barterAvailable: true,
    distanceKm: 2,
    location: "Koramangala",
    image: "https://images.unsplash.com/photo-1556656793-08538906a9f8?auto=format&fit=crop&w=900&q=80",
    description: "128GB, battery health 89%, includes original charger and case.",
    seller: { name: "Aarav Sharma", rating: 4.8, avatar: "" },
  },
  {
    id: "2",
    title: "Minimalist Wooden Study Desk",
    category: "Furniture",
    price: 6500,
    barterAvailable: false,
    distanceKm: 5,
    location: "Indiranagar",
    image: "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=900&q=80",
    description: "Solid teak wood desk, ideal for compact workspaces.",
    seller: { name: "Priya Nair", rating: 4.7, avatar: "" },
  },
  {
    id: "3",
    title: "Atomic Habits + Deep Work Bundle",
    category: "Books",
    price: 850,
    barterAvailable: true,
    distanceKm: 1,
    location: "HSR Layout",
    image: "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=900&q=80",
    description: "Two bestselling productivity books, almost new condition.",
    seller: { name: "Neel Shah", rating: 4.9, avatar: "" },
  },
  {
    id: "4",
    title: "Road Bicycle - 18 Speed",
    category: "Vehicles",
    price: 12000,
    barterAvailable: true,
    distanceKm: 4,
    location: "JP Nagar",
    image: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=900&q=80",
    description: "Lightweight alloy frame with recently serviced drivetrain.",
    seller: { name: "Riya Khanna", rating: 4.6, avatar: "" },
  },
  {
    id: "5",
    title: "Nike Air Max Sneakers",
    category: "Fashion",
    price: 2800,
    barterAvailable: false,
    distanceKm: 3,
    location: "BTM",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
    description: "Size 9, lightly used, original box available.",
    seller: { name: "Kabir Mehta", rating: 4.5, avatar: "" },
  },
  {
    id: "6",
    title: "Indoor Fiddle Leaf Fig",
    category: "Home Decor",
    price: 1500,
    barterAvailable: true,
    distanceKm: 6,
    location: "Whitefield",
    image: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=900&q=80",
    description: "Healthy 4-foot plant in ceramic pot, pickup only.",
    seller: { name: "Sara Ali", rating: 4.8, avatar: "" },
  },
];

export const chatMessages = [
  { id: "m1", fromMe: false, text: "Hi! Is the iPhone still available?", time: "10:42" },
  { id: "m2", fromMe: true, text: "Yes, available. Want to check it today?", time: "10:43" },
  { id: "m3", fromMe: false, text: "Can you do ₹40,000 or barter with AirPods Pro?", time: "10:45" },
  { id: "m4", fromMe: true, text: "Open to offers — let's discuss in person.", time: "10:46" },
];
