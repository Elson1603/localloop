const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export type Product = {
  product_id: string;
  owner_id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  location: string;
  image_urls: string[];
  status: string;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  message_id: string;
  chat_id: string;
  sender_user_id: string;
  recipient_user_id: string;
  message: string;
  created_at: string;
};

export type Offer = {
  offer_id: string;
  product_id: string;
  buyer_user_id: string;
  offered_price: number;
  note?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type UserProfile = {
  user_id: string;
  email: string;
  username: string;
  display_name: string;
  phone?: string | null;
  location?: string | null;
  created_at: string;
  updated_at: string;
};

const getAuthToken = (): string | null => localStorage.getItem("localloop_access_token");

const authHeaders = (): HeadersInit => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const parseError = async (response: Response): Promise<string> => {
  try {
    const data = (await response.json()) as { detail?: string };
    if (data?.detail) {
      return data.detail;
    }
  } catch {
    // ignore
  }
  return response.statusText || "Request failed";
};

export const listProducts = async (): Promise<Product[]> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/products`);
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as Product[];
};

export const getProduct = async (productId: string): Promise<Product> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/products/${productId}`);
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as Product;
};

export const createProduct = async (payload: {
  title: string;
  description: string;
  category: string;
  price: number;
  location: string;
  image_urls: string[];
}): Promise<Product> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as Product;
};

export const listChatMessages = async (chatId: string): Promise<ChatMessage[]> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/chats/messages?chat_id=${encodeURIComponent(chatId)}`);
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as ChatMessage[];
};

export const createChatMessage = async (payload: {
  chat_id: string;
  recipient_user_id: string;
  message: string;
}): Promise<ChatMessage> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/chats/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as ChatMessage;
};

export const createOffer = async (payload: {
  product_id: string;
  offered_price: number;
  note?: string;
}): Promise<Offer> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/offers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as Offer;
};

export const getMyProfile = async (): Promise<UserProfile> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
    headers: {
      ...authHeaders(),
    },
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as UserProfile;
};
