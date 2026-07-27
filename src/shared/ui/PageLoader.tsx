import type React from "react";

interface PageLoaderProps {
  message?: string;
}

export const PageLoader: React.FC<PageLoaderProps> = ({ message = "Loading..." }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[100vh] w-full bg-white">
      <div className="text-center">
        <div className="relative inline-block">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600" />
          <img
            src="/assets/images/rm-bulb.webp"
            alt="Rareminds Logo"
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 object-contain"
          />
        </div>
        <div className="mt-6">
          <p className="text-xl font-semibold text-gray-800 mb-2">{message}</p>
          <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
            Powered by <span className="font-semibold text-indigo-600">Rareminds</span>
          </p>
        </div>
      </div>
    </div>
  );
};
