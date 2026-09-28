import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface JsonViewerProps {
  data: string | object;
  maxHeight?: string;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({ data, maxHeight = 'max-h-96' }) => {
  const [copied, setCopied] = useState(false);
  const [isRaw, setIsRaw] = useState(false);

  let parsed: any = null;
  let isJson = false;
  let formattedString = '';

  if (typeof data === 'string') {
    formattedString = data;
    try {
      parsed = JSON.parse(data);
      isJson = true;
      formattedString = JSON.stringify(parsed, null, 2);
    } catch {
      isJson = false;
    }
  } else {
    parsed = data;
    isJson = true;
    formattedString = JSON.stringify(data, null, 2);
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Syntax highlighting for JSON
  const renderHighlightedJson = (jsonString: string) => {
    // Regex for tokens: strings, numbers, booleans, null, keys
    const regex = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g;

    const lines = jsonString.split('\n');

    return lines.map((line, idx) => {
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      let match;

      while ((match = regex.exec(line)) !== null) {
        // Text before match
        if (match.index > lastIndex) {
          parts.push(line.substring(lastIndex, match.index));
        }

        const token = match[0];
        let colorClass = 'text-zinc-200';

        if (/^"/.test(token)) {
          if (/:$/.test(token)) {
            // JSON Key
            colorClass = 'text-amber-400 font-semibold';
          } else {
            // String value
            colorClass = 'text-emerald-400';
          }
        } else if (/true|false/.test(token)) {
          // Boolean
          colorClass = 'text-purple-400 font-semibold';
        } else if (/null/.test(token)) {
          // Null
          colorClass = 'text-zinc-500 italic';
        } else {
          // Number
          colorClass = 'text-cyan-400';
        }

        parts.push(
          <span key={`${idx}-${match.index}`} className={colorClass}>
            {token}
          </span>
        );

        lastIndex = regex.lastIndex;
      }

      if (lastIndex < line.length) {
        parts.push(line.substring(lastIndex));
      }

      return (
        <div key={idx} className="table-row font-mono text-[11px] leading-5 hover:bg-white/[0.03]">
          <span className="table-cell pr-4 text-right select-none text-zinc-600 font-mono text-[10px] w-8">
            {idx + 1}
          </span>
          <span className="table-cell whitespace-pre font-mono">
            {parts}
          </span>
        </div>
      );
    });
  };

  return (
    <div className="relative border border-[#232838] bg-[#07080c] overflow-hidden text-xs">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0e1017] border-b border-[#232838] font-mono text-[10px]">
        <div className="flex items-center gap-2 text-zinc-400 uppercase tracking-wider">
          <span className="inline-block size-2 rounded-full bg-emerald-500/80"></span>
          <span>{isJson ? 'JSON Payload' : 'Plain Text / Binary'}</span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-500">{new Blob([formattedString]).size} bytes</span>
        </div>
        <div className="flex items-center gap-2">
          {isJson && (
            <button
              onClick={() => setIsRaw(!isRaw)}
              className="px-2 py-0.5 text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 uppercase tracking-widest text-[9px] transition-colors"
            >
              {isRaw ? 'Formatted' : 'Raw'}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-0.5 text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 uppercase tracking-widest text-[9px] transition-colors"
          >
            {copied ? (
              <>
                <Check className="size-3 text-emerald-400" />
                <span className="text-emerald-400 font-bold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Area */}
      <div className={`p-3 overflow-auto ${maxHeight} selection:bg-white selection:text-black font-mono`}>
        {isRaw || !isJson ? (
          <pre className="font-mono text-[11px] text-zinc-200 whitespace-pre-wrap break-all leading-5">
            {formattedString}
          </pre>
        ) : (
          <div className="table w-full">
            {renderHighlightedJson(formattedString)}
          </div>
        )}
      </div>
    </div>
  );
};
