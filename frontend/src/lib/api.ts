import { getValidAccessToken, getValidIdToken } from "@/lib/auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export type ProductStatus = "active" | "reserved" | "sold" | "archived";

export type Product = {
  product_id: string;
  owner_id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  image_refs?: string[];
  image_urls: string[];
  status: ProductStatus;
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

export type OfferStatus = "accepted" | "rejected";

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

export type PublicUserProfile = {
  user_id: string;
  username: string;
  display_name: string;
};

export type LocalLoopNotification = {
  notification_id: string;
  recipient_user_id: string;
  title: string;
  message: string;
  reference_id?: string | null;
  reference_type?: string | null;
  is_read: boolean;
  created_at: string;
};

export type AiPriceSuggestion = {
  min_price: number;
  max_price: number;
  reason: string;
};

export type AiDescriptionSuggestion = {
  description: string;
  keywords: string[];
};


type PresignUploadResponse = {
  upload_url: string;
  object_key: string;
  expires_in: number;
};

const getAuthToken = (): string | null => getValidAccessToken();

const getIdToken = (): string | null => getValidIdToken();

const authHeaders = (): HeadersInit => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const userProfileHeaders = (): HeadersInit => {
  const idToken = getIdToken();
  if (idToken) {
    return { Authorization: `Bearer ${idToken}` };
  }
  return authHeaders();
};

const parseError = async (response: Response): Promise<string> => {
  try {
    const data = (await response.json()) as { detail?: unknown };
    const detail = data?.detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string };
      if (typeof first?.msg === "string" && first.msg.trim()) {
        return first.msg;
      }
      return JSON.stringify(detail);
    }
    if (detail && typeof detail === "object") {
      return JSON.stringify(detail);
    }
  } catch {
    // ignore
  }
  return response.statusText || "Request failed";
};

export const listProducts = async (params?: { ownerId?: string; status?: ProductStatus }): Promise<Product[]> => {
  const query = new URLSearchParams();
  if (params?.ownerId) {
    query.set("owner_id", params.ownerId);
  }
  if (params?.status) {
    query.set("status", params.status);
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
  latitude: number;
  longitude: number;
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

export const updateProduct = async (
  productId: string,
  payload: {
    title: string;
    description: string;
    category: string;
    price: number;
    location: string;
    latitude: number;
    longitude: number;
    image_urls: string[];
  },
): Promise<Product> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/products/${encodeURIComponent(productId)}`, {
    method: "PUT",
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

export const updateProductStatus = async (payload: {
  productId: string;
  status: ProductStatus;
}): Promise<Product> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/products/${encodeURIComponent(payload.productId)}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ status: payload.status }),
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
  if (!getAuthToken()) {
    return [];
  }
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

  const response = await fetch(`${API_BASE_URL}/api/v1/chats/messages?${query.toString()}`, {
    headers: {
      ...authHeaders(),
    },
  });
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
  if (!getAuthToken()) {
    return [];
  }
  const query = new URLSearchParams();
  if (params?.productId) {
    query.set("product_id", params.productId);
  }
  if (params?.buyerUserId) {
    query.set("buyer_user_id", params.buyerUserId);
  }

  const suffix = query.size ? `?${query.toString()}` : "";
  const response = await fetch(`${API_BASE_URL}/api/v1/offers${suffix}`, {
    headers: {
      ...authHeaders(),
    },
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as Offer[];
};

export const updateOfferStatus = async (payload: {
  offerId: string;
  status: OfferStatus;
}): Promise<Offer> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/offers/${encodeURIComponent(payload.offerId)}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ status: payload.status }),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as Offer;
};

export const getMyProfile = async (): Promise<UserProfile> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
    headers: {
      ...userProfileHeaders(),
    },
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as UserProfile;
};

export const getUserProfile = async (userId: string): Promise<PublicUserProfile> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/users/${encodeURIComponent(userId)}`, {
    headers: {
      ...userProfileHeaders(),
    },
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as PublicUserProfile;
};

export const listNotifications = async (): Promise<LocalLoopNotification[]> => {
  if (!getAuthToken()) {
    return [];
  }
  const response = await fetch(`${API_BASE_URL}/api/v1/notifications`, {
    headers: {
      ...authHeaders(),
    },
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as LocalLoopNotification[];
};

export const markNotificationRead = async (notificationId: string): Promise<LocalLoopNotification> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: "PUT",
    headers: {
      ...authHeaders(),
    },
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as LocalLoopNotification;
};

export const suggestPriceWithAi = async (payload: {
  title: string;
  category: string;
  condition?: string;
  location?: string;
  description?: string;
  currency?: string;
}): Promise<AiPriceSuggestion> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/ai/price-suggestion`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      currency: "INR",
      ...payload,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as AiPriceSuggestion;
};

export const generateProductDescriptionWithAi = async (payload: {
  title: string;
  category: string;
  condition?: string;
  location?: string;
  image?: File;
}): Promise<AiDescriptionSuggestion> => {
  const formData = new FormData();
  formData.append("title", payload.title);
  formData.append("category", payload.category);
  formData.append("condition", payload.condition ?? "");
  formData.append("location", payload.location ?? "");
  if (payload.image) {
    formData.append("image", payload.image);
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/ai/product-description`, {
    method: "POST",
    headers: {
      ...authHeaders(),
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as AiDescriptionSuggestion;
};
