/*
 * Copyright 2025 PKA-OpenLD
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faShareAlt,
  faTimes,
  faCopy,
  faCheck,
} from "@fortawesome/free-solid-svg-icons";
import { faFacebook, faTwitter } from "@fortawesome/free-brands-svg-icons";

interface ShareButtonProps {
  reportId: string;
  description: string;
  type: string;
  severity: string;
}

export default function ShareButton({
  reportId,
  description,
  type,
  severity,
}: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/report/${reportId}`;
  const shareText = `⚠️ Báo cáo ${type === "flood" ? "ngập lụt" : "mất điện"} - ${severity === "high" ? "Nghiêm trọng" : severity === "medium" ? "Trung bình" : "Nhẹ"}: ${description.substring(0, 100)}...`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleShareFacebook = () => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
    window.open(fbUrl, "_blank", "width=600,height=400");
  };

  const handleShareTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, "_blank", "width=600,height=400");
  };

  if (!isOpen) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        title="Chia sẻ"
      >
        <FontAwesomeIcon
          icon={faShareAlt}
          className="text-gray-600 dark:text-gray-400"
        />
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center animate-fadeIn"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-96 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Chia sẻ báo cáo
          </h3>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <FontAwesomeIcon
              icon={faTimes}
              className="text-gray-600 dark:text-gray-400"
            />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 line-clamp-3">
          {description}
        </p>

        <div className="space-y-3">
          <button
            onClick={handleShareFacebook}
            className="w-full flex items-center gap-3 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
          >
            <FontAwesomeIcon icon={faFacebook} size="lg" />
            Chia sẻ trên Facebook
          </button>

          <button
            onClick={handleShareTwitter}
            className="w-full flex items-center gap-3 p-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-medium transition-colors"
          >
            <FontAwesomeIcon icon={faTwitter} size="lg" />
            Chia sẻ trên Twitter
          </button>

          <button
            onClick={handleCopyLink}
            className="w-full flex items-center justify-center gap-3 p-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-xl font-medium transition-colors"
          >
            <FontAwesomeIcon icon={copied ? faCheck : faCopy} />
            {copied ? "Đã sao chép!" : "Sao chép liên kết"}
          </button>
        </div>

        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400 break-all">
            {shareUrl}
          </p>
        </div>
      </div>
    </div>
  );
}
