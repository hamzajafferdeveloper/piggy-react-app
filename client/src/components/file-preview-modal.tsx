import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Eye, FileText, Image as ImageIcon } from "lucide-react";

export type AttachmentMeta = {
  originalName: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
};

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: AttachmentMeta[];
  title?: string;
}

export function FilePreviewModal({
  isOpen,
  onClose,
  files,
  title = "Attached Files",
}: FilePreviewModalProps) {
  const renderTrigger = (file: AttachmentMeta) => {
    const isImage = file.mimeType.startsWith("image/");

    if (isImage) {
      return (
        <div className="border rounded-md overflow-hidden bg-muted/20">
          <img
            src={file.url}
            alt={file.originalName}
            className="w-full h-48 object-contain bg-black/5"
          />
        </div>
      );
    }

    return (
      <div className="border rounded-md p-8 flex flex-col items-center justify-center bg-muted/20 gap-2 h-48">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <span className="text-sm text-muted-foreground text-center line-clamp-2 px-4">
          No preview available
        </span>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {files.length} file{files.length !== 1 ? "s" : ""} attached
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {files.map((file, idx) => (
              <div key={idx} className="space-y-2 group relative">
                {renderTrigger(file)}

                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 overflow-hidden">
                    {file.mimeType.startsWith("image/") ? (
                      <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span
                      className="text-sm font-medium truncate"
                      title={file.originalName}
                    >
                      {file.originalName}
                    </span>
                  </div>

                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      asChild
                      title="Open in new tab"
                    >
                      <a href={file.url} target="_blank" rel="noreferrer">
                        <Eye className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      asChild
                      title="Download"
                    >
                      <a href={file.url} download>
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
