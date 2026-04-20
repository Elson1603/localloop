import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus, Sparkles, UploadCloud, X, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MarketNavbar } from "@/components/localloop/MarketNavbar";
import { PageShell } from "@/components/localloop/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { categories } from "@/data/mockData";

const PostItem = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [barterEnabled, setBarterEnabled] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; description?: string; category?: string; images?: string }>({});
  const [isPublishing, setIsPublishing] = useState(false);

  const handleFileSelect = (selected: FileList | null) => {
    const nextFiles = selected ? Array.from(selected).filter((file) => file.type.startsWith("image/")).slice(0, 6) : [];
    setFiles(nextFiles);
    setErrors((prev) => ({ ...prev, images: nextFiles.length ? undefined : prev.images }));
  };

  const removeFile = (fileName: string) => {
    setFiles((prev) => prev.filter((file) => file.name !== fileName));
  };

  const previewImages = useMemo(
    () => files.map((file) => ({ key: `${file.name}-${file.lastModified}`, name: file.name, url: URL.createObjectURL(file) })),
    [files],
  );

  useEffect(() => {
    return () => {
      previewImages.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previewImages]);

  const suggestedPrice = useMemo(() => {
    const numeric = Number(price);
    if (!numeric) return "Suggested ₹500–₹700 based on nearby listings.";
    const floor = Math.max(100, Math.round(numeric * 0.85));
    const ceil = Math.round(numeric * 1.15);
    return `Suggested ₹${floor.toLocaleString()}–₹${ceil.toLocaleString()} based on nearby listings.`;
  }, [price]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextErrors = {
      title: title.trim() ? undefined : "Title is required",
      description: description.trim().length >= 20 ? undefined : "Description should be at least 20 characters",
      category: category ? undefined : "Please choose a category",
      images: files.length ? undefined : "Upload at least one image",
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

    setIsPublishing(true);
    setTimeout(() => {
      setIsPublishing(false);
      toast({ title: "Listing ready", description: "Your item has been staged successfully." });
    }, 850);
  };

  return (
    <div className="min-h-screen">
      <MarketNavbar />
      <PageShell>
        <h1 className="mb-1 text-3xl font-bold">Post Item</h1>
        <p className="mb-6 text-sm text-muted-foreground">List it in seconds with smart suggestions and a polished listing preview.</p>
        <section className="glass rounded-2xl p-6 animate-enter">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <motion.div
              className={`rounded-2xl border border-dashed p-6 text-center transition-all duration-300 ${
                dragActive ? "border-accent bg-accent/10 shadow-soft" : "border-border bg-card/70 hover:border-accent/40"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragActive(false);
                handleFileSelect(event.dataTransfer.files);
              }}
              whileHover={{ scale: 1.005 }}
            >
              <ImagePlus className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-medium">Upload images (drag & drop)</p>
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
                <UploadCloud className="mr-2 h-4 w-4" /> Choose files
              </Button>
              {errors.images && <p className="mt-2 text-sm text-destructive">{errors.images}</p>}
              {previewImages.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2 text-left sm:grid-cols-3">
                  <AnimatePresence>
                    {previewImages.map((preview) => (
                      <motion.div
                        key={preview.key}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="group relative overflow-hidden rounded-xl border border-border/70 bg-background/80"
                      >
                        <img src={preview.url} alt={preview.name} className="h-24 w-full object-cover" loading="lazy" />
                        <button
                          type="button"
                          onClick={() => removeFile(preview.name)}
                          className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground opacity-0 transition-smooth group-hover:opacity-100"
                          aria-label={`Remove ${preview.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <p className="truncate px-2 py-1 text-[11px] text-muted-foreground">{preview.name}</p>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
              <p className="mt-3 text-xs text-muted-foreground">{files.length}/6 images selected</p>
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
                      <Zap className="mr-2 h-4 w-4 animate-pulse" /> Publishing...
                    </span>
                  ) : (
                    "Publish Listing"
                  )}
                </Button>
              </motion.div>
            </form>
          </div>
        </section>
      </PageShell>
    </div>
  );
};

export default PostItem;
