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
    <div className="relative flex min-h-screen flex-col font-sans">
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] h-[50vw] w-[50vw] rounded-full bg-rose-600/10 blur-[120px]" />
        <div className="absolute top-[20%] -right-[10%] h-[40vw] w-[40vw] rounded-full bg-amber-600/10 blur-[120px]" />
        <div className="absolute -bottom-[20%] left-[20%] h-[60vw] w-[60vw] rounded-full bg-fuchsia-600/10 blur-[120px]" />
      </div>

      <header className="fixed top-6 left-1/2 z-50 -translate-x-1/2 w-[95%] max-w-5xl rounded-full border border-white/10 bg-neutral-950/60 p-2 pr-4 backdrop-blur-2xl shadow-2xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-amber-500 text-lg font-black text-white shadow-[0_0_20px_rgba(244,63,94,0.4)]">
            CL
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Cloudlet</h1>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Vault</p>
          </div>
        </div>
        <SignOutButton />
      </header>

      <main className="relative z-10 flex-1 px-4 pt-36 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-4xl">
          <Content />
        </div>
      </main>
      <Toaster richColors closeButton position="top-center" theme="dark" />
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
  if (loggedInUser === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-neutral-800 border-t-rose-500" />
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
    <div className="flex flex-col gap-16">
      {/* HERO SECTION */}
      <section className="flex flex-col items-center text-center gap-8 py-10">
        <div className="inline-flex items-center gap-3 rounded-full border border-rose-500/20 bg-rose-500/10 px-5 py-2 text-sm font-bold text-rose-400">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500"></span>
          </span>
          SECURE VAULT
        </div>
        <h2 className="text-5xl font-black tracking-tighter text-white sm:text-7xl">
          Your Digital <br />
          <span className="bg-gradient-to-r from-rose-400 via-fuchsia-400 to-amber-400 bg-clip-text text-transparent">
            Sanctuary.
          </span>
        </h2>
        <Authenticated>
          <p className="max-w-xl text-lg font-medium text-neutral-400 sm:text-xl">
            Welcome back, <span className="text-white">{loggedInUser?.email ?? "friend"}</span>. Your files are encrypted and ready.
          </p>
        </Authenticated>
        <Unauthenticated>
          <p className="max-w-xl text-lg font-medium text-neutral-400 sm:text-xl">
            A minimalist, lightning-fast cloud storage solution designed for seamless organization.
          </p>
        </Unauthenticated>
      </section>

      <Unauthenticated>
        <div className="mx-auto w-full max-w-md">
          <SignInForm />
        </div>
      </Unauthenticated>

      <Authenticated>
        <>
          {/* ACTIONS BAR */}
          <section className="sticky top-28 z-40 flex flex-col gap-4 rounded-[2rem] border border-white/5 bg-neutral-900/80 p-4 backdrop-blur-xl shadow-2xl sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <input type="file" ref={fileInput} onChange={handleFileUpload} className="hidden" />
              <button onClick={() => fileInput.current?.click()} className="btn-primary px-6 py-3 text-sm">
                <span className="text-lg">+</span> Upload File
              </button>
              <button onClick={handleCreateFolder} className="btn-secondary px-6 py-3 text-sm">
                New Folder
              </button>
            </div>
            {currentFolder && (
              <button onClick={() => setCurrentFolder(null)} className="btn-ghost">
                ← Back to Root
              </button>
            )}
          </section>

          {/* LIST VIEW */}
          <section className="flex flex-col gap-4">
            {isLoadingItems ? (
              <div className="flex flex-col gap-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-24 w-full animate-pulse rounded-3xl bg-white/[0.03]"
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {items?.folders.map((folder) => (
                  <div
                    key={folder._id}
                    className="group flex items-center justify-between rounded-3xl border border-white/5 bg-white/[0.02] p-4 transition-all hover:border-white/10 hover:bg-white/[0.04] hover:shadow-xl"
                  >
                    <button
                      onClick={() => setCurrentFolder(folder._id)}
                      className="flex flex-1 items-center gap-5 text-left outline-none"
                    >
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-neutral-800 text-2xl transition-colors group-hover:bg-amber-500/20 group-hover:text-amber-400">
                        📁
                      </div>
                      <div className="flex flex-col">
                        <span className="text-lg font-bold text-neutral-100 transition-colors group-hover:text-white">
                          {folder.name}
                        </span>
                        <span className="text-sm font-medium text-neutral-500">
                          Folder
                        </span>
                      </div>
                    </button>
                    <button
                      onClick={() => deleteFolder({ folderId: folder._id })}
                      className="rounded-xl bg-red-500/10 px-4 py-2 text-sm font-bold text-red-500 opacity-0 transition-all hover:bg-red-500/20 group-hover:opacity-100"
                    >
                      Delete
                    </button>
                  </div>
                ))}

                {items?.files.map((file) => (
                  <div
                    key={file._id}
                    className="group flex items-center justify-between rounded-3xl border border-white/5 bg-white/[0.02] p-4 transition-all hover:border-white/10 hover:bg-white/[0.04] hover:shadow-xl"
                  >
                    <div className="flex flex-1 items-center gap-5">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-neutral-800 text-2xl transition-colors group-hover:bg-rose-500/20 group-hover:text-rose-400">
                        📄
                      </div>
                      <div className="flex flex-col">
                        <span className="text-lg font-bold text-neutral-100 transition-colors group-hover:text-white line-clamp-1">
                          {file.name}
                        </span>
                        <span className="text-sm font-medium text-neutral-500 mt-0.5">
                          {(file.size / 1024 / 1024).toFixed(2)} MB •{" "}
                          {new Date(file._creationTime).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 opacity-0 transition-all group-hover:opacity-100">
                      {file.url && (
                        <a
                          href={file.url}
                          download={file.name}
                          className="rounded-xl bg-neutral-800 px-4 py-2 text-sm font-bold text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-white"
                        >
                          Download
                        </a>
                      )}
                      <button
                        onClick={() => handleDeleteFile(file)}
                        className="rounded-xl bg-red-500/10 px-4 py-2 text-sm font-bold text-red-500 transition-colors hover:bg-red-500/20"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}

                {hasNoContent && (
                  <div className="flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-neutral-800 bg-white/[0.01] p-16 text-center">
                    <div className="mb-6 text-6xl opacity-30">📭</div>
                    <h3 className="text-xl font-bold text-neutral-200">
                      Vault is empty
                    </h3>
                    <p className="mt-2 text-sm font-medium text-neutral-500">
                      Upload a file or create a folder to begin.
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      </Authenticated>
    </div>
  );
}
