import {
  Authenticated,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";
import { useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface px-4 sm:px-6">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between">
          <span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
            <CloudIcon />
            iris-ops
          </span>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-4xl">
          <Content />
        </div>
      </main>
      <Toaster position="bottom-right" />
    </div>
  );
}

type Crumb = { id: Id<"folders">; name: string };

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const [path, setPath] = useState<Crumb[]>([]);
  const [uploading, setUploading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const currentFolder = path.length ? path[path.length - 1].id : null;
  const items = useQuery(api.files.listItems, { parentId: currentFolder });
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const createFile = useMutation(api.files.createFile);
  const createFolder = useMutation(api.files.createFolder);
  const deleteFile = useMutation(api.files.deleteFile);
  const deleteFolder = useMutation(api.files.deleteFolder);

  if (loggedInUser === undefined) {
    return <p className="py-24 text-center text-sm text-muted">Loading…</p>;
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    const contentType = file.type || "application/octet-stream";

    setUploading(true);
    try {
      const { uploadUrl, uniqueFileName } = await generateUploadUrl({
        fileName: file.name,
        fileType: contentType,
      });

      const result = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });

      if (!result.ok) {
        throw new Error(`Upload failed with status ${result.status}. Try again.`);
      }

      await createFile({
        name: file.name,
        size: file.size,
        storageId: uniqueFileName,
        parentId: currentFolder,
      });

      toast.success(`Uploaded ${file.name}`);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Upload failed. Try again.";
      if (/Failed to fetch|CORS|NetworkError/i.test(message)) {
        toast.error("Storage refused the upload. Check the bucket's CORS settings for this address.");
      } else {
        toast.error(message);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleCreateFolder = async (name: string) => {
    try {
      await createFolder({ name, parentId: currentFolder });
      setCreatingFolder(false);
    } catch {
      toast.error("Couldn't create the folder. Try again.");
    }
  };

  const handleDeleteFolder = async (folder: { _id: Id<"folders">; name: string }) => {
    if (!confirm(`Delete "${folder.name}" and everything in it? This can't be undone.`)) return;
    try {
      await deleteFolder({ folderId: folder._id });
      toast.success(`Deleted ${folder.name}`);
    } catch {
      toast.error("Couldn't delete the folder. Try again.");
    }
  };

  const handleDeleteFile = async (file: { storageId: string; name: string }) => {
    try {
      await deleteFile({ storageId: file.storageId });
      toast.success(`Deleted ${file.name}`);
    } catch (error) {
      console.error(error);
      toast.error("Couldn't delete the file. Try again.");
    }
  };

  const hasNoContent =
    items !== undefined && items.folders.length === 0 && items.files.length === 0;

  return (
    <>
      <Unauthenticated>
        <SignInForm />
      </Unauthenticated>

      <Authenticated>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <nav aria-label="Folder path">
              <ol className="flex flex-wrap items-baseline gap-x-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                <li>
                  {path.length ? (
                    <button className="text-muted hover:text-ink" onClick={() => setPath([])}>
                      My files
                    </button>
                  ) : (
                    <span aria-current="page">My files</span>
                  )}
                </li>
                {path.map((crumb, i) => (
                  <li key={crumb.id} className="flex items-baseline gap-x-2">
                    <span className="text-line" aria-hidden>/</span>
                    {i === path.length - 1 ? (
                      <span aria-current="page" className="break-all">{crumb.name}</span>
                    ) : (
                      <button
                        className="break-all text-muted hover:text-ink"
                        onClick={() => setPath(path.slice(0, i + 1))}
                      >
                        {crumb.name}
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            </nav>

            <div className="flex shrink-0 gap-2">
              <input type="file" ref={fileInput} onChange={handleFileUpload} className="hidden" />
              <button className="btn-secondary" onClick={() => setCreatingFolder(true)}>
                New folder
              </button>
              <button
                className="btn-primary"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
              >
                {uploading ? "Uploading…" : "Upload file"}
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            <div className="hidden grid-cols-[1fr_6rem_8rem_9.5rem] gap-4 border-b border-line px-4 py-2.5 text-xs font-medium text-muted sm:grid">
              <span>Name</span>
              <span className="text-right">Size</span>
              <span>Added</span>
              <span className="sr-only">Actions</span>
            </div>

            {creatingFolder && (
              <NewFolderRow onCreate={handleCreateFolder} onCancel={() => setCreatingFolder(false)} />
            )}

            {items === undefined ? (
              <p className="px-4 py-10 text-center text-sm text-muted">Loading files…</p>
            ) : (
              <ul className="divide-y divide-line">
                {items.folders.map((folder) => (
                  <li key={folder._id} className={rowClass}>
                    <button
                      className="flex min-w-0 items-center gap-3 text-left font-medium hover:text-accent"
                      onClick={() => setPath([...path, { id: folder._id, name: folder.name }])}
                    >
                      <FolderIcon />
                      <span className="truncate">{folder.name}</span>
                    </button>
                    <span className="hidden text-right text-muted sm:block">—</span>
                    <span className="hidden text-muted sm:block">
                      {formatDate(folder._creationTime)}
                    </span>
                    <div className="flex justify-end">
                      <button className="btn-danger" onClick={() => handleDeleteFolder(folder)}>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}

                {items.files.map((file) => (
                  <li key={file._id} className={rowClass}>
                    <span className="flex min-w-0 items-center gap-3">
                      <FileIcon />
                      <span className="truncate">{file.name}</span>
                    </span>
                    <span className="hidden text-right tabular-nums text-muted sm:block">
                      {formatSize(file.size)}
                    </span>
                    <span className="hidden tabular-nums text-muted sm:block">
                      {formatDate(file._creationTime)}
                    </span>
                    <div className="flex justify-end gap-1">
                      {file.url && (
                        <a className="btn-quiet" href={file.url} download={file.name}>
                          Download
                        </a>
                      )}
                      <button className="btn-danger" onClick={() => handleDeleteFile(file)}>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {hasNoContent && !creatingFolder && (
              <div className="px-4 py-14 text-center">
                <p className="font-medium">
                  {path.length ? "This folder is empty" : "No files yet"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  Upload a file or create a folder to get started.
                </p>
              </div>
            )}
          </div>
        </div>
      </Authenticated>
    </>
  );
}

const rowClass =
  "grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-2.5 text-sm sm:grid-cols-[1fr_6rem_8rem_9.5rem]";

function NewFolderRow({
  onCreate,
  onCancel,
}: {
  onCreate: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  return (
    <form
      className="flex items-center gap-2 border-b border-line px-4 py-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (trimmed) void onCreate(trimmed);
      }}
    >
      <FolderIcon />
      <input
        autoFocus
        className="input-field py-1.5"
        placeholder="Folder name"
        aria-label="Folder name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
      />
      <button type="submit" className="btn-primary py-1.5" disabled={!name.trim()}>
        Create
      </button>
      <button type="button" className="btn-quiet" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function CloudIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="text-accent">
      <path
        d="M7 18h10.5a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.5 9.1 4.5 4.5 0 0 0 7 18Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden className="shrink-0 text-accent">
      <path
        d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.4l2 2h8.6A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11Z"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-muted">
      <path
        d="M6 3.5h8l4 4v13H6v-17Z M14 3.5v4h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
