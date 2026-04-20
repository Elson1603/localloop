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

type PresignUploadResponse = {
  upload_url: string;
  object_key: string;
  expires_in: number;
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

export const listProducts = async (params?: { ownerId?: string }): Promise<Product[]> => {
  const query = new URLSearchParams();
  if (params?.ownerId) {
    query.set("owner_id", params.ownerId);
  }
  const suffix = query.size ? `?${query.toString()}` : "";
  const response = await fetch(`${API_BASE_URL}/api/v1/products${suffix}`);
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

export const presignProductImageUpload = async (payload: {
  file_name: string;
  content_type: string;
}): Promise<PresignUploadResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/storage/presign-upload`, {
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

  return (await response.json()) as PresignUploadResponse;
};

export const uploadFileToS3 = async (uploadUrl: string, file: File): Promise<void> => {
  try {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error("Failed to upload image to S3");
    }
  } catch {
    throw new Error("S3 upload blocked. Configure bucket CORS or use backend upload fallback.");
  }
};

export const uploadProductImageViaApi = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/v1/storage/upload`, {
    method: "POST",
    headers: {
      ...authHeaders(),
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as PresignUploadResponse;
  return data.object_key;
};

export const listChatMessages = async (params: {
  chatId?: string;
  senderUserId?: string;
  recipientUserId?: string;
}): Promise<ChatMessage[]> => {
  const query = new URLSearchParams();
  if (params.chatId) {
    query.set("chat_id", params.chatId);
  }
  if (params.senderUserId) {
    query.set("sender_user_id", params.senderUserId);
  }
  if (params.recipientUserId) {
    query.set("recipient_user_id", params.recipientUserId);
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/chats/messages?${query.toString()}`);
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

export const listOffers = async (params?: {
  productId?: string;
  buyerUserId?: string;
}): Promise<Offer[]> => {
  const query = new URLSearchParams();
  if (params?.productId) {
    query.set("product_id", params.productId);
  }
  if (params?.buyerUserId) {
    query.set("buyer_user_id", params.buyerUserId);
  }

  const suffix = query.size ? `?${query.toString()}` : "";
  const response = await fetch(`${API_BASE_URL}/api/v1/offers${suffix}`);
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as Offer[];
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
