import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, FlipHorizontal, ImagePlus, LocateFixed, RotateCw, Sparkles, UploadCloud, X, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MarketNavbar } from "@/components/localloop/MarketNavbar";
import { PageShell } from "@/components/localloop/PageShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { createProduct, getProduct, presignProductImageUpload, updateProduct, uploadFileToS3, uploadProductImageViaApi } from "@/lib/api";
import { requestCurrentPosition, saveUserCoordinates, type Coordinates } from "@/lib/location";
import { categories } from "@/data/mockData";

type UploadImage = {
  id: string;
  name: string;
  previewUrl: string;
  file?: File;
  existingRef?: string;
};

type ImageEditDraft = {
  rotateQuarterTurns: number;
  flipX: boolean;
  brightness: number;
  contrast: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
};

type PreviewRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type CropDragState = {
  startX: number;
  startY: number;
  isActive: boolean;
};

type CropHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

type CropResizeState = {
  handle: CropHandle;
  startX: number;
  startY: number;
  startCrop: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

type CropAspectPreset = "free" | "1:1" | "4:3" | "16:9";

const DEFAULT_EDIT_DRAFT: ImageEditDraft = {
  rotateQuarterTurns: 0,
  flipX: false,
  brightness: 100,
  contrast: 100,
  cropX: 0,
  cropY: 0,
  cropWidth: 1,
  cropHeight: 1,
};

const MIN_CROP_SIZE = 0.05;

const getAspectRatioValue = (preset: CropAspectPreset): number | null => {
  if (preset === "1:1") {
    return 1;
  }
  if (preset === "4:3") {
    return 4 / 3;
  }
  if (preset === "16:9") {
    return 16 / 9;
  }
  return null;
};

const createUploadImage = (file: File): UploadImage => ({
  id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
  name: file.name,
  file,
  previewUrl: URL.createObjectURL(file),
});

const createExistingUploadImage = (previewUrl: string, existingRef: string, index: number): UploadImage => {
  const fallbackName = `existing-image-${index + 1}`;
  const inferredName = existingRef.split("/").pop() || fallbackName;
  return {
    id: `existing-${index}-${Math.random().toString(36).slice(2, 8)}`,
    name: inferredName,
    previewUrl,
    existingRef,
  };
};

const loadImageElement = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to load image for editing."));
    };
    image.src = url;
  });

const applyEditsToFile = async (file: File, edits: ImageEditDraft): Promise<File> => {
  const image = await loadImageElement(file);

  const cropWidthRatio = Math.min(1, Math.max(0.05, edits.cropWidth));
  const cropHeightRatio = Math.min(1, Math.max(0.05, edits.cropHeight));
  const sourceWidth = Math.max(1, Math.round(image.width * cropWidthRatio));
  const sourceHeight = Math.max(1, Math.round(image.height * cropHeightRatio));
  const sourceX = Math.round(image.width * Math.min(1 - cropWidthRatio, Math.max(0, edits.cropX)));
  const sourceY = Math.round(image.height * Math.min(1 - cropHeightRatio, Math.max(0, edits.cropY)));

  const rotateQuarterTurns = ((edits.rotateQuarterTurns % 4) + 4) % 4;
  const isSideways = rotateQuarterTurns % 2 === 1;
  const canvas = document.createElement("canvas");
  canvas.width = isSideways ? sourceHeight : sourceWidth;
  canvas.height = isSideways ? sourceWidth : sourceHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to initialize image editor.");
  }

  context.filter = `brightness(${edits.brightness}%) contrast(${edits.contrast}%)`;
  context.translate(canvas.width / 2, canvas.height / 2);
  context.scale(edits.flipX ? -1 : 1, 1);
  context.rotate((rotateQuarterTurns * Math.PI) / 2);
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    -sourceWidth / 2,
    -sourceHeight / 2,
    sourceWidth,
    sourceHeight,
  );

  const outputType = ["image/jpeg", "image/png", "image/webp"].includes(file.type) ? file.type : "image/jpeg";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error("Failed to render edited image."));
        return;
      }
      resolve(result);
    }, outputType, 0.92);
  });

  return new File([blob], file.name, { type: blob.type, lastModified: Date.now() });
};

const PostItem = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const editProductId = searchParams.get("productId") || "";
  const isEditMode = Boolean(editProductId);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [barterEnabled, setBarterEnabled] = useState(false);
  const [images, setImages] = useState<UploadImage[]>([]);
  const [errors, setErrors] = useState<{ title?: string; description?: string; category?: string; images?: string; price?: string; location?: string }>({});
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [hasLiveLocation, setHasLiveLocation] = useState(false);
  const [liveCoords, setLiveCoords] = useState<Coordinates | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(isEditMode);
  const [isPublishing, setIsPublishing] = useState(false);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ImageEditDraft>(DEFAULT_EDIT_DRAFT);
  const [isApplyingEdit, setIsApplyingEdit] = useState(false);
  const [previewRect, setPreviewRect] = useState<PreviewRect | null>(null);
  const [cropDrag, setCropDrag] = useState<CropDragState | null>(null);
  const [cropResize, setCropResize] = useState<CropResizeState | null>(null);
  const [cropAspectPreset, setCropAspectPreset] = useState<CropAspectPreset>("free");
  const imagesRef = useRef<UploadImage[]>([]);
  const cropPreviewContainerRef = useRef<HTMLDivElement | null>(null);
  const cropImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  const handleFileSelect = (selected: FileList | null) => {
    const nextFiles = selected ? Array.from(selected).filter((file) => file.type.startsWith("image/")) : [];
    const nextImages = nextFiles.map(createUploadImage);
    setImages((prev) => {
      const merged = [...prev, ...nextImages].slice(0, 6);
      const allowedIds = new Set(merged.map((image) => image.id));
      [...prev, ...nextImages].forEach((image) => {
        if (!allowedIds.has(image.id) && image.file) {
          URL.revokeObjectURL(image.previewUrl);
        }
      });
      return merged;
    });
    setErrors((prev) => ({ ...prev, images: undefined }));
  };

  const removeFile = (imageId: string) => {
    setImages((prev) => {
      const target = prev.find((image) => image.id === imageId);
      if (target?.file) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((image) => image.id !== imageId);
    });
  };

  const moveImage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= images.length) {
      return;
    }
    setImages((prev) => {
      const reordered = [...prev];
      const [picked] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, picked);
      return reordered;
    });
  };

  const openEditor = (imageId: string) => {
    const target = images.find((image) => image.id === imageId);
    if (!target?.file) {
      toast({
        title: "Re-upload required",
        description: "To edit this existing photo, remove and upload it again.",
      });
      return;
    }
    setEditingImageId(imageId);
    setEditDraft(DEFAULT_EDIT_DRAFT);
    setCropDrag(null);
    setCropResize(null);
    setCropAspectPreset("free");
  };

  const editingImage = useMemo(
    () => images.find((image) => image.id === editingImageId) ?? null,
    [images, editingImageId],
  );

  const applyEdits = async () => {
    if (!editingImage?.file) {
      return;
    }

    try {
      setIsApplyingEdit(true);
      const editedFile = await applyEditsToFile(editingImage.file, editDraft);
      const nextPreview = URL.createObjectURL(editedFile);
      setImages((prev) =>
        prev.map((image) => {
          if (image.id !== editingImage.id) {
            return image;
          }
          URL.revokeObjectURL(image.previewUrl);
          return {
            ...image,
            name: editedFile.name,
            file: editedFile,
            previewUrl: nextPreview,
            existingRef: undefined,
          };
        }),
      );
      setEditingImageId(null);
      setEditDraft(DEFAULT_EDIT_DRAFT);
      toast({ title: "Photo updated", description: "Image edits have been applied." });
    } catch (error: unknown) {
      toast({
        title: "Edit failed",
        description: error instanceof Error ? error.message : "Unable to edit image.",
        variant: "destructive",
      });
    } finally {
      setIsApplyingEdit(false);
    }
  };

  useEffect(() => {
    const updatePreviewRect = () => {
      if (!cropPreviewContainerRef.current || !cropImageRef.current) {
        return;
      }

      const container = cropPreviewContainerRef.current;
      const imageElement = cropImageRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const naturalWidth = imageElement.naturalWidth;
      const naturalHeight = imageElement.naturalHeight;

      if (!containerWidth || !containerHeight || !naturalWidth || !naturalHeight) {
        return;
      }

      const containerRatio = containerWidth / containerHeight;
      const imageRatio = naturalWidth / naturalHeight;

      let width = containerWidth;
      let height = containerHeight;
      if (imageRatio > containerRatio) {
        height = containerWidth / imageRatio;
      } else {
        width = containerHeight * imageRatio;
      }

      setPreviewRect({
        left: (containerWidth - width) / 2,
        top: (containerHeight - height) / 2,
        width,
        height,
      });
    };

    updatePreviewRect();
    window.addEventListener("resize", updatePreviewRect);
    return () => window.removeEventListener("resize", updatePreviewRect);
  }, [editingImage]);

  const normalizeCropRect = (x: number, y: number, width: number, height: number) => {
    const normalizedWidth = Math.min(1, Math.max(MIN_CROP_SIZE, width));
    const normalizedHeight = Math.min(1, Math.max(MIN_CROP_SIZE, height));
    const normalizedX = Math.min(1 - normalizedWidth, Math.max(0, x));
    const normalizedY = Math.min(1 - normalizedHeight, Math.max(0, y));

    return {
      x: normalizedX,
      y: normalizedY,
      width: normalizedWidth,
      height: normalizedHeight,
    };
  };

  const applyAspectConstraint = (
    rect: { x: number; y: number; width: number; height: number },
    handle: CropHandle | "drag",
    dx: number,
    dy: number,
  ) => {
    const ratio = getAspectRatioValue(cropAspectPreset);
    if (!ratio) {
      return rect;
    }

    let nextWidth = rect.width;
    let nextHeight = rect.height;
    if (Math.abs(dx) >= Math.abs(dy)) {
      nextHeight = nextWidth / ratio;
    } else {
      nextWidth = nextHeight * ratio;
    }

    if (handle === "drag") {
      return normalizeCropRect(rect.x, rect.y, nextWidth, nextHeight);
    }

    if (handle === "se") {
      return normalizeCropRect(rect.x, rect.y, nextWidth, nextHeight);
    }

    if (handle === "sw") {
      return normalizeCropRect(rect.x + (rect.width - nextWidth), rect.y, nextWidth, nextHeight);
    }

    if (handle === "ne") {
      return normalizeCropRect(rect.x, rect.y + (rect.height - nextHeight), nextWidth, nextHeight);
    }

    if (handle === "e") {
      const centeredY = rect.y + (rect.height - nextHeight) / 2;
      return normalizeCropRect(rect.x, centeredY, nextWidth, nextHeight);
    }

    if (handle === "w") {
      const centeredY = rect.y + (rect.height - nextHeight) / 2;
      return normalizeCropRect(rect.x + (rect.width - nextWidth), centeredY, nextWidth, nextHeight);
    }

    if (handle === "n") {
      const centeredX = rect.x + (rect.width - nextWidth) / 2;
      return normalizeCropRect(centeredX, rect.y + (rect.height - nextHeight), nextWidth, nextHeight);
    }

    if (handle === "s") {
      const centeredX = rect.x + (rect.width - nextWidth) / 2;
      return normalizeCropRect(centeredX, rect.y, nextWidth, nextHeight);
    }

    return normalizeCropRect(rect.x + (rect.width - nextWidth), rect.y + (rect.height - nextHeight), nextWidth, nextHeight);
  };

  const updateCropFromPointer = (clientX: number, clientY: number, startX: number, startY: number) => {
    if (!previewRect || !cropPreviewContainerRef.current) {
      return;
    }

    const bounds = cropPreviewContainerRef.current.getBoundingClientRect();
    const toRelative = (x: number, y: number) => {
      const px = (x - bounds.left - previewRect.left) / previewRect.width;
      const py = (y - bounds.top - previewRect.top) / previewRect.height;
      return {
        x: Math.min(1, Math.max(0, px)),
        y: Math.min(1, Math.max(0, py)),
      };
    };

    const start = toRelative(startX, startY);
    const current = toRelative(clientX, clientY);

    const x1 = Math.min(start.x, current.x);
    const y1 = Math.min(start.y, current.y);
    const x2 = Math.max(start.x, current.x);
    const y2 = Math.max(start.y, current.y);

    const width = Math.max(MIN_CROP_SIZE, x2 - x1);
    const height = Math.max(MIN_CROP_SIZE, y2 - y1);
    const baseRect = normalizeCropRect(x1, y1, width, height);
    const constrained = applyAspectConstraint(baseRect, "drag", current.x - start.x, current.y - start.y);

    setEditDraft((prev) => ({
      ...prev,
      cropX: constrained.x,
      cropY: constrained.y,
      cropWidth: constrained.width,
      cropHeight: constrained.height,
    }));
  };

  const updateCropFromResize = (clientX: number, clientY: number, resizeState: CropResizeState) => {
    if (!previewRect || !cropPreviewContainerRef.current) {
      return;
    }

    const deltaX = (clientX - resizeState.startX) / previewRect.width;
    const deltaY = (clientY - resizeState.startY) / previewRect.height;
    const start = resizeState.startCrop;

    let x = start.x;
    let y = start.y;
    let width = start.width;
    let height = start.height;

    if (resizeState.handle === "nw") {
      x = start.x + deltaX;
      y = start.y + deltaY;
      width = start.width - deltaX;
      height = start.height - deltaY;
    } else if (resizeState.handle === "n") {
      y = start.y + deltaY;
      height = start.height - deltaY;
    } else if (resizeState.handle === "ne") {
      y = start.y + deltaY;
      width = start.width + deltaX;
      height = start.height - deltaY;
    } else if (resizeState.handle === "e") {
      width = start.width + deltaX;
    } else if (resizeState.handle === "s") {
      height = start.height + deltaY;
    } else if (resizeState.handle === "sw") {
      x = start.x + deltaX;
      width = start.width - deltaX;
      height = start.height + deltaY;
    } else if (resizeState.handle === "w") {
      x = start.x + deltaX;
      width = start.width - deltaX;
    } else {
      width = start.width + deltaX;
      height = start.height + deltaY;
    }

    const normalized = normalizeCropRect(x, y, width, height);
    const constrained = applyAspectConstraint(normalized, resizeState.handle, deltaX, deltaY);

    setEditDraft((prev) => ({
      ...prev,
      cropX: constrained.x,
      cropY: constrained.y,
      cropWidth: constrained.width,
      cropHeight: constrained.height,
    }));
  };

  useEffect(() => {
    if (!cropDrag?.isActive && !cropResize) {
      return;
    }

    const onMove = (event: MouseEvent) => {
      if (cropDrag?.isActive) {
        updateCropFromPointer(event.clientX, event.clientY, cropDrag.startX, cropDrag.startY);
      }
      if (cropResize) {
        updateCropFromResize(event.clientX, event.clientY, cropResize);
      }
    };
    const onUp = () => {
      setCropDrag(null);
      setCropResize(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [cropDrag, cropResize, previewRect, cropAspectPreset]);

  useEffect(() => {
    const ratio = getAspectRatioValue(cropAspectPreset);
    if (!ratio) {
      return;
    }

    setEditDraft((prev) => {
      let width = prev.cropWidth;
      let height = prev.cropHeight;
      if (width / height > ratio) {
        width = height * ratio;
      } else {
        height = width / ratio;
      }

      const centerX = prev.cropX + prev.cropWidth / 2;
      const centerY = prev.cropY + prev.cropHeight / 2;
      const nextX = Math.min(1 - width, Math.max(0, centerX - width / 2));
      const nextY = Math.min(1 - height, Math.max(0, centerY - height / 2));

      return {
        ...prev,
        cropX: nextX,
        cropY: nextY,
        cropWidth: Math.max(MIN_CROP_SIZE, width),
        cropHeight: Math.max(MIN_CROP_SIZE, height),
      };
    });
  }, [cropAspectPreset]);

  const nudgeCrop = (deltaX: number, deltaY: number) => {
    setEditDraft((prev) => {
      const nextX = prev.cropX + deltaX;
      const nextY = prev.cropY + deltaY;
      const normalized = normalizeCropRect(nextX, nextY, prev.cropWidth, prev.cropHeight);
      return {
        ...prev,
        cropX: normalized.x,
        cropY: normalized.y,
      };
    });
  };

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((image) => {
        if (image.file) {
          URL.revokeObjectURL(image.previewUrl);
        }
      });
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadProductForEdit = async () => {
      if (!isEditMode || !editProductId) {
        setIsLoadingProduct(false);
        return;
      }

      setIsLoadingProduct(true);
      try {
        const product = await getProduct(editProductId);
        if (!mounted) {
          return;
        }

        setTitle(product.title || "");
        setDescription(product.description || "");
        setPrice(String(product.price ?? ""));
        setCategory(product.category || "");
        setLocation(product.location || "");

        if (typeof product.latitude === "number" && typeof product.longitude === "number") {
          setLiveCoords({ latitude: product.latitude, longitude: product.longitude });
          setHasLiveLocation(true);
        }

        const refs = product.image_refs && product.image_refs.length === product.image_urls.length
          ? product.image_refs
          : product.image_urls;

        const existingImages = product.image_urls.map((previewUrl, index) =>
          createExistingUploadImage(previewUrl, refs[index] || previewUrl, index),
        );
        setImages(existingImages);
        setErrors({});
      } catch (error: unknown) {
        toast({
          title: "Unable to load listing",
          description: error instanceof Error ? error.message : "Only your own active listing can be edited.",
          variant: "destructive",
        });
        navigate("/listings");
      } finally {
        if (mounted) {
          setIsLoadingProduct(false);
        }
      }
    };

    void loadProductForEdit();

    return () => {
      mounted = false;
    };
  }, [editProductId, isEditMode, navigate, toast]);

  const suggestedPrice = useMemo(() => {
    const numeric = Number(price);
    if (!numeric) return "Suggested ₹500–₹700 based on nearby listings.";
    const floor = Math.max(100, Math.round(numeric * 0.85));
    const ceil = Math.round(numeric * 1.15);
    return `Suggested ₹${floor.toLocaleString()}–₹${ceil.toLocaleString()} based on nearby listings.`;
  }, [price]);

  const detectLiveLocation = async () => {
    setIsDetectingLocation(true);
    try {
      const coords = await requestCurrentPosition();
      saveUserCoordinates(coords);
      const formattedLocation = `Lat ${coords.latitude.toFixed(6)}, Lng ${coords.longitude.toFixed(6)}`;
      setLocation(formattedLocation);
      setHasLiveLocation(true);
      setLiveCoords(coords);
      setErrors((prev) => ({ ...prev, location: undefined }));
      toast({
        title: "Live location captured",
        description: "Your current coordinates will be used for this listing.",
      });
    } catch (error: unknown) {
      setHasLiveLocation(false);
      setLiveCoords(null);
      setErrors((prev) => ({ ...prev, location: "Live location is required. Please allow location access." }));
      toast({
        title: "Location access needed",
        description: error instanceof Error ? error.message : "Unable to fetch live location.",
        variant: "destructive",
      });
    } finally {
      setIsDetectingLocation(false);
    }
  };

  useEffect(() => {
    if (isEditMode) {
      return;
    }
    void detectLiveLocation();
  }, [isEditMode]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const numericPrice = Number(price);
    const nextErrors = {
      title: title.trim() ? undefined : "Title is required",
      description: description.trim().length >= 20 ? undefined : "Description should be at least 20 characters",
      category: category ? undefined : "Please choose a category",
      images: images.length ? undefined : "Upload at least one image",
      price: numericPrice > 0 ? undefined : "Price must be greater than 0",
      location: hasLiveLocation && liveCoords && location.trim() ? undefined : "Live location is required",
    };
    setErrors(nextErrors);

    const hasErrors = Object.values(nextErrors).some(Boolean);
    if (hasErrors) {
      toast({
        title: "Complete required fields",
        description: "Please fix highlighted fields before publishing.",
        variant: "destructive",
      });
      return;
    }

    if (!liveCoords) {
      toast({
        title: "Location required",
        description: "Please capture your live location before publishing.",
        variant: "destructive",
      });
      return;
    }

    setIsPublishing(true);
    try {
      const uploadedObjectKeys = await Promise.all(
        images.map(async (image) => {
          if (image.existingRef && !image.file) {
            return image.existingRef;
          }

          const file = image.file;
          if (!file) {
            throw new Error("Image payload is invalid. Please remove and upload the image again.");
          }

          try {
            const presigned = await presignProductImageUpload({
              file_name: file.name,
              content_type: file.type,
            });
            await uploadFileToS3(presigned.upload_url, file);
            return presigned.object_key;
          } catch {
            // Fallback route via backend to bypass bucket CORS issues in local setup.
            return await uploadProductImageViaApi(file);
          }
        }),
      );

      const payload = {
        title: title.trim(),
        description: description.trim(),
        category,
        price: numericPrice,
        location: location.trim(),
        latitude: liveCoords.latitude,
        longitude: liveCoords.longitude,
        image_urls: uploadedObjectKeys,
      };

      if (isEditMode && editProductId) {
        await updateProduct(editProductId, payload);
        toast({ title: "Listing updated", description: "Your changes have been saved." });
        navigate(`/listings/${editProductId}`);
      } else {
        await createProduct(payload);
        toast({ title: "Listing published", description: "Your item is now live in marketplace." });
        navigate("/listings");
      }
    } catch (error: unknown) {
      toast({
        title: "Publish failed",
        description: error instanceof Error ? error.message : "Please login and try again.",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  if (isLoadingProduct) {
    return (
      <div className="min-h-screen">
        <MarketNavbar />
        <PageShell>
          <section className="glass rounded-2xl p-6">
            <p className="text-sm text-muted-foreground">Loading listing for edit...</p>
          </section>
        </PageShell>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <MarketNavbar />
      <PageShell>
        <h1 className="mb-1 text-3xl font-bold">{isEditMode ? "Edit Item" : "Post Item"}</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {isEditMode ? "Update your listing details and save changes." : "List it in seconds with smart suggestions and a polished listing preview."}
        </p>
        <section className="glass rounded-2xl p-6 animate-enter">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <motion.div
              className="rounded-2xl border border-dashed border-border bg-card/70 p-6 text-center transition-all duration-300 hover:border-accent/40"
              whileHover={{ scale: 1.005 }}
            >
              <ImagePlus className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-medium">Upload images</p>
              <p className="text-sm text-muted-foreground">JPG, PNG up to 10MB</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => handleFileSelect(event.target.files)}
              />
              <Button type="button" variant="secondary" className="mt-4 rounded-full" onClick={() => fileInputRef.current?.click()}>
                <UploadCloud className="mr-2 h-4 w-4" /> {isEditMode ? "Add files" : "Choose files"}
              </Button>
              {errors.images && <p className="mt-2 text-sm text-destructive">{errors.images}</p>}
              {images.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2 text-left sm:grid-cols-3">
                  <AnimatePresence>
                    {images.map((image, index) => (
                      <motion.div
                        key={image.id}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="group relative overflow-hidden rounded-xl border border-border/70 bg-background/80"
                      >
                        <img src={image.previewUrl} alt={image.name} className="h-24 w-full object-cover" loading="lazy" />
                        {index === 0 ? (
                          <span className="absolute left-1 top-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">Cover</span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => removeFile(image.id)}
                          className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground opacity-0 transition-smooth group-hover:opacity-100"
                          aria-label={`Remove ${image.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <div className="flex items-center justify-between gap-1 px-1 py-1">
                          <button
                            type="button"
                            className="rounded p-1 text-muted-foreground hover:bg-secondary disabled:opacity-40"
                            onClick={() => moveImage(index, index - 1)}
                            disabled={index === 0}
                            aria-label="Move image left"
                          >
                            <ArrowLeft className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="rounded px-2 py-1 text-[10px] font-medium text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => openEditor(image.id)}
                            disabled={!image.file}
                            title={!image.file ? "Re-upload this image to edit" : "Edit image"}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 text-muted-foreground hover:bg-secondary disabled:opacity-40"
                            onClick={() => moveImage(index, index + 1)}
                            disabled={index === images.length - 1}
                            aria-label="Move image right"
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="truncate px-2 pb-1 text-[11px] text-muted-foreground">{image.name}</p>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
              <p className="mt-3 text-xs text-muted-foreground">{images.length}/6 images selected. Use arrows to reorder cover order.</p>
            </motion.div>

            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Mid-century coffee table"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                  }}
                />
                {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe condition, age, included accessories..."
                  className="min-h-[120px]"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
                  }}
                />
                <p className="text-xs text-muted-foreground">{description.trim().length}/500 characters</p>
                {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (optional)</Label>
                  <Input id="price" type="number" placeholder="e.g. 500" value={price} onChange={(e) => setPrice(e.target.value)} />
                  {errors.price && <p className="text-sm text-destructive">{errors.price}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <div className="flex gap-2">
                    <Input id="location" value={location} readOnly placeholder="Capture your live location" />
                    <Button type="button" variant="secondary" onClick={() => void detectLiveLocation()} disabled={isDetectingLocation}>
                      <LocateFixed className="mr-2 h-4 w-4" />
                      {isDetectingLocation ? "Locating..." : "Use live"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Publishing requires live location from your device.</p>
                  {errors.location && <p className="text-sm text-destructive">{errors.location}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={category}
                    onValueChange={(value) => {
                      setCategory(value);
                      if (errors.category) setErrors((prev) => ({ ...prev, category: undefined }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.category && <p className="text-sm text-destructive">{errors.category}</p>}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card px-3 py-2">
                <Label htmlFor="barter">Enable barter offers</Label>
                <Switch id="barter" checked={barterEnabled} onCheckedChange={setBarterEnabled} />
              </div>

              <div className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm">
                <p className="inline-flex items-center font-medium text-foreground">
                  <Sparkles className="mr-2 h-4 w-4 text-accent" /> AI price suggestion
                </p>
                <p className="mt-1 text-muted-foreground">{suggestedPrice}</p>
              </div>

              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Button
                  type="submit"
                  disabled={isPublishing}
                  className="w-full rounded-full bg-accent py-6 text-base font-semibold text-accent-foreground transition-smooth hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isPublishing ? (
                    <span className="inline-flex items-center">
                      <Zap className="mr-2 h-4 w-4 animate-pulse" /> {isEditMode ? "Saving..." : "Publishing..."}
                    </span>
                  ) : (
                    isEditMode ? "Save Changes" : "Publish Listing"
                  )}
                </Button>
              </motion.div>
            </form>
          </div>
        </section>

        <Dialog open={Boolean(editingImage)} onOpenChange={(open) => (!open ? setEditingImageId(null) : undefined)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Photo</DialogTitle>
              <DialogDescription>Adjust rotation, flip, brightness, and contrast before uploading.</DialogDescription>
            </DialogHeader>

            {editingImage ? (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-xl border border-border/70 bg-muted/40">
                  <div ref={cropPreviewContainerRef} className="relative h-64 w-full">
                    <img
                      ref={cropImageRef}
                      src={editingImage.previewUrl}
                      alt={editingImage.name}
                      className="h-64 w-full object-contain"
                      onLoad={() => {
                        if (!cropPreviewContainerRef.current || !cropImageRef.current) {
                          return;
                        }

                        const container = cropPreviewContainerRef.current;
                        const imageElement = cropImageRef.current;
                        const containerWidth = container.clientWidth;
                        const containerHeight = container.clientHeight;
                        const naturalWidth = imageElement.naturalWidth;
                        const naturalHeight = imageElement.naturalHeight;
                        if (!containerWidth || !containerHeight || !naturalWidth || !naturalHeight) {
                          return;
                        }

                        const containerRatio = containerWidth / containerHeight;
                        const imageRatio = naturalWidth / naturalHeight;
                        let width = containerWidth;
                        let height = containerHeight;
                        if (imageRatio > containerRatio) {
                          height = containerWidth / imageRatio;
                        } else {
                          width = containerHeight * imageRatio;
                        }

                        setPreviewRect({
                          left: (containerWidth - width) / 2,
                          top: (containerHeight - height) / 2,
                          width,
                          height,
                        });
                      }}
                      style={{
                        transform: `rotate(${editDraft.rotateQuarterTurns * 90}deg) scaleX(${editDraft.flipX ? -1 : 1})`,
                        filter: `brightness(${editDraft.brightness}%) contrast(${editDraft.contrast}%)`,
                      }}
                    />
                    {previewRect ? (
                      <div
                        className="absolute cursor-crosshair focus:outline-none focus:ring-2 focus:ring-accent/60"
                        style={{
                          left: previewRect.left,
                          top: previewRect.top,
                          width: previewRect.width,
                          height: previewRect.height,
                        }}
                        tabIndex={0}
                        onKeyDown={(event) => {
                          const step = event.shiftKey ? 0.03 : 0.01;
                          if (event.key === "ArrowLeft") {
                            event.preventDefault();
                            nudgeCrop(-step, 0);
                          } else if (event.key === "ArrowRight") {
                            event.preventDefault();
                            nudgeCrop(step, 0);
                          } else if (event.key === "ArrowUp") {
                            event.preventDefault();
                            nudgeCrop(0, -step);
                          } else if (event.key === "ArrowDown") {
                            event.preventDefault();
                            nudgeCrop(0, step);
                          }
                        }}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setCropDrag({ startX: event.clientX, startY: event.clientY, isActive: true });
                          updateCropFromPointer(event.clientX, event.clientY, event.clientX, event.clientY);
                        }}
                      >
                        <div
                          className="pointer-events-none absolute border-2 border-accent"
                          style={{
                            left: `${editDraft.cropX * 100}%`,
                            top: `${editDraft.cropY * 100}%`,
                            width: `${editDraft.cropWidth * 100}%`,
                            height: `${editDraft.cropHeight * 100}%`,
                            boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)",
                          }}
                        />
                        {([
                          { key: "nw", left: editDraft.cropX, top: editDraft.cropY },
                          { key: "n", left: editDraft.cropX + editDraft.cropWidth / 2, top: editDraft.cropY },
                          { key: "ne", left: editDraft.cropX + editDraft.cropWidth, top: editDraft.cropY },
                          { key: "e", left: editDraft.cropX + editDraft.cropWidth, top: editDraft.cropY + editDraft.cropHeight / 2 },
                          { key: "se", left: editDraft.cropX + editDraft.cropWidth, top: editDraft.cropY + editDraft.cropHeight },
                          { key: "s", left: editDraft.cropX + editDraft.cropWidth / 2, top: editDraft.cropY + editDraft.cropHeight },
                          { key: "sw", left: editDraft.cropX, top: editDraft.cropY + editDraft.cropHeight },
                          { key: "w", left: editDraft.cropX, top: editDraft.cropY + editDraft.cropHeight / 2 },
                        ] as Array<{ key: CropHandle; left: number; top: number }>).map((handle) => (
                          <button
                            key={handle.key}
                            type="button"
                            className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background bg-accent shadow"
                            style={{
                              left: `${handle.left * 100}%`,
                              top: `${handle.top * 100}%`,
                            }}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setCropResize({
                                handle: handle.key,
                                startX: event.clientX,
                                startY: event.clientY,
                                startCrop: {
                                  x: editDraft.cropX,
                                  y: editDraft.cropY,
                                  width: editDraft.cropWidth,
                                  height: editDraft.cropHeight,
                                },
                              });
                            }}
                            aria-label={`Resize crop ${handle.key}`}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-4">
                  {(["free", "1:1", "4:3", "16:9"] as CropAspectPreset[]).map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant={cropAspectPreset === preset ? "default" : "outline"}
                      className="h-8"
                      onClick={() => setCropAspectPreset(preset)}
                    >
                      {preset === "free" ? "Free" : preset}
                    </Button>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setEditDraft((prev) => ({ ...prev, rotateQuarterTurns: (prev.rotateQuarterTurns + 1) % 4 }))}
                  >
                    <RotateCw className="mr-2 h-4 w-4" /> Rotate 90 deg
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setEditDraft((prev) => ({ ...prev, flipX: !prev.flipX }))}
                  >
                    <FlipHorizontal className="mr-2 h-4 w-4" /> Flip Horizontal
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Brightness</span>
                    <span>{editDraft.brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={140}
                    value={editDraft.brightness}
                    onChange={(event) => setEditDraft((prev) => ({ ...prev, brightness: Number(event.target.value) }))}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Contrast</span>
                    <span>{editDraft.contrast}%</span>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={140}
                    value={editDraft.contrast}
                    onChange={(event) => setEditDraft((prev) => ({ ...prev, contrast: Number(event.target.value) }))}
                    className="w-full"
                  />
                </div>

                <p className="text-xs text-muted-foreground">Drag on the image to draw crop selection. The highlighted area will be kept.</p>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditDraft((prev) => ({ ...prev, cropX: 0, cropY: 0, cropWidth: 1, cropHeight: 1 }))}
                    disabled={isApplyingEdit}
                  >
                    Reset Crop
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditDraft(DEFAULT_EDIT_DRAFT)} disabled={isApplyingEdit}>
                    Reset
                  </Button>
                  <Button type="button" onClick={() => void applyEdits()} disabled={isApplyingEdit}>
                    {isApplyingEdit ? "Applying..." : "Apply changes"}
                  </Button>
                </DialogFooter>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </PageShell>
    </div>
  );
};

export default PostItem;
