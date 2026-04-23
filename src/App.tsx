import {
  Authenticated,
  Unauthenticated,
  useAction,
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
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-hero-radial"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[540px] w-[540px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-[140px]"
        aria-hidden="true"
      />
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-sky-500 text-base font-semibold text-white shadow-glow">
              CL
            </span>
            <div>
              <h1 className="text-base font-semibold text-slate-50">
                Cloudlet
              </h1>
              <p className="text-xs text-slate-400">Store. Organize. Share.</p>
            </div>
          </div>
          <SignOutButton />
        </div>
      </header>
      <main className="relative z-10 flex-1 px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
          <Content />
        </div>
      </main>
      <Toaster richColors closeButton position="top-right" />
    </div>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const [currentFolder, setCurrentFolder] = useState<Id<"folders"> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const items = useQuery(api.files.listItems, { parentId: currentFolder });
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const createFile = useMutation(api.files.createFile);
  const createFolder = useMutation(api.files.createFolder);
  const deleteFile = useMutation(api.files.deleteFile);
  const deleteFolder = useMutation(api.files.deleteFolder);
  const deleteFileFromS3 = useAction(api.files.deleteFileFromS3);

  if (loggedInUser === undefined) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <span className="h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-indigo-400" />
      </div>
    );
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const contentType = file.type || "application/octet-stream";

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
        const responseText = await result.text().catch(() => "");
        throw new Error(
          `Failed to upload file to S3 (${result.status}${responseText ? `: ${responseText}` : ""})`,
        );
      }

      await createFile({
        name: file.name,
        size: file.size,
        storageId: uniqueFileName,
        parentId: currentFolder,
      });

      toast.success("File uploaded successfully");
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to upload file";

      if (/Failed to fetch|CORS|NetworkError/i.test(message)) {
        toast.error(
          "Upload was blocked by S3 CORS or bucket permissions. Allow PUT from http://localhost:5173 on the bucket.",
        );
      } else {
        toast.error(message);
      }
    }
  };

  const handleCreateFolder = async () => {
    const name = prompt("Enter folder name:");
    if (!name) return;

    try {
      await createFolder({ name, parentId: currentFolder });
      toast.success("Folder created successfully");
    } catch (error) {
      toast.error("Failed to create folder");
    }
  };

  const handleDeleteFile = async (file: { _id: string; storageId: string }) => {
    try {
      await deleteFile({ storageId: file.storageId });
      await deleteFileFromS3({ storageId: file.storageId });
      toast.success("File deleted successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete file");
    }
  };

  const isLoadingItems = items === undefined;
  const hasNoContent =
    items !== undefined &&
    items.folders.length === 0 &&
    items.files.length === 0;

  return (
    <div className="flex flex-col gap-10 pb-10">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="glass-panel relative overflow-hidden p-8">
          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <span className="inline-flex w-fit animate-glow items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                Cloud workspace
              </span>
              <h2 className="text-4xl font-semibold leading-tight text-slate-50 md:text-5xl">
                CloudLet
              </h2>
              <Authenticated>
                <p className="text-lg text-slate-300">
                  Welcome back, {loggedInUser?.email ?? "friend"}! Manage,
                  organize, and keep every file within reach.
                </p>
              </Authenticated>
              <Unauthenticated>
                <p className="text-lg text-slate-300">
                  Sign in to unlock secure storage with elegant organization and
                  instant access.
                </p>
              </Unauthenticated>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-slate-200">
                <span className="block text-xs uppercase tracking-wide text-slate-400">
                  Uploads
                </span>
                Lightning-fast transfers direct to secure cloud storage.
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-slate-200">
                <span className="block text-xs uppercase tracking-wide text-slate-400">
                  Organization
                </span>
                Nest folders to keep work and personal projects tidy.
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-slate-200">
                <span className="block text-xs uppercase tracking-wide text-slate-400">
                  Access
                </span>
                Download or share files instantly with expiring links.
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <Authenticated>
            <div className="glass-panel h-full p-8">
              <div className="relative z-10 flex h-full flex-col justify-between gap-6">
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold text-slate-50">
                    Stay in flow
                  </h3>
                  <p className="text-sm text-slate-300">
                    Use quick actions below to keep your workspace organized.
                    Files are backed by secure object storage.
                  </p>
                </div>
                <div className="grid gap-3 text-sm text-slate-300">
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-400" />
                    Encrypted uploads with expiring S3 URLs.
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    Manage folders to reflect your workflow.
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                    Download files anywhere, anytime.
                  </div>
                </div>
              </div>
            </div>
          </Authenticated>
          <Unauthenticated>
            <SignInForm />
          </Unauthenticated>
        </div>
      </section>

      <Authenticated>
        <>
          <section className="glass-panel p-6">
            <div className="relative z-10 flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold text-slate-50">
                  Library actions
                </h3>
                <p className="text-sm text-slate-300">
                  Upload files or create folders to keep everything streamlined.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <input
                  type="file"
                  ref={fileInput}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInput.current?.click()}
                  className="btn-primary"
                >
                  Upload File
                </button>
                <button
                  onClick={handleCreateFolder}
                  className="btn-secondary"
                >
                  New Folder
                </button>
                {currentFolder && (
                  <button
                    onClick={() => setCurrentFolder(null)}
                    className="btn-secondary"
                  >
                    Back to Root
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Tip: Files remain available for download for an hour after each
                link is generated.
              </p>
            </div>
          </section>

          <section className="flex flex-col gap-6">
            {isLoadingItems ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="animate-pulse rounded-3xl border border-white/10 bg-white/5 p-6"
                  />
                ))}
              </div>
            ) : (
              <>
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {items?.folders.map((folder) => (
                    <div
                      key={folder._id}
                      className="group relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-5 shadow-lg transition hover:-translate-y-1 hover:border-indigo-400/40 hover:shadow-glow"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <button
                          onClick={() => setCurrentFolder(folder._id)}
                          className="flex items-center gap-3 text-left transition hover:opacity-90"
                        >
                          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-2xl">
                            📁
                          </span>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-100">
                              {folder.name}
                            </span>
                            <span className="text-xs text-slate-400">
                              Open folder
                            </span>
                          </div>
                        </button>
                        <button
                          onClick={() => deleteFolder({ folderId: folder._id })}
                          className="rounded-full border border-red-400/30 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:border-red-300 hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}

                  {items?.files.map((file) => (
                    <div
                      key={file._id}
                      className="relative flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/60 p-5 shadow-lg transition hover:-translate-y-1 hover:border-indigo-400/40 hover:shadow-glow"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15 text-2xl">
                            📄
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-slate-100">
                              {file.name}
                            </p>
                            <p className="text-xs text-slate-400">
                              {(file.size / 1024 / 1024).toFixed(2)} MB •{" "}
                              {new Date(file._creationTime).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {file.url && (
                          <a
                            href={file.url}
                            download={file.name}
                            className="inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-indigo-400/60 hover:text-indigo-300"
                          >
                            Download
                          </a>
                        )}
                        <button
                          onClick={() => handleDeleteFile(file)}
                          className="inline-flex items-center gap-1 rounded-full border border-red-400/30 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:border-red-300 hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {hasNoContent && (
                  <div className="glass-panel p-10 text-center text-slate-300">
                    Start by uploading a file or creating a folder to see it appear
                    here.
                  </div>
                )}
              </>
            )}
          </section>
        </>
      </Authenticated>
    </div>
  );
}
