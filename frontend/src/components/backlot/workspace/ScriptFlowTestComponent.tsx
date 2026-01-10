/**
 * TEST COMPONENT for debugging script flow layout
 *
 * This simplified component tests whether lines flow naturally when a textarea expands.
 */
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';

export const ScriptFlowTestComponent: React.FC = () => {
  const [lines, setLines] = useState([
    'This is line 1',
    'This is line 2',
    'This is line 3',
    'This is line 4',
    'This is line 5',
  ]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleChange = (index: number, value: string) => {
    const newLines = [...lines];
    newLines[index] = value;
    setLines(newLines);
  };

  const autoResize = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded shadow">
        <h1 className="text-2xl font-bold mb-4">Script Flow Layout Test</h1>
        <p className="mb-4 text-gray-600">
          Click a line to edit it. Type a very long sentence to see if the lines below move down.
        </p>

        {editingIndex !== null && (
          <div className="mb-4 p-3 bg-blue-50 rounded">
            <p className="text-sm text-blue-800">
              Editing line {editingIndex + 1}. The lines below should move down as you type.
            </p>
            <Button onClick={() => setEditingIndex(null)} className="mt-2">
              Stop Editing
            </Button>
          </div>
        )}

        <div className="border-2 border-gray-300 p-6 bg-white">
          {/* Page container */}
          <div className="relative" style={{ width: '600px', minHeight: '400px' }}>
            {/* Content area with padding (like screenplay margins) */}
            <div className="relative" style={{ paddingLeft: '100px', paddingTop: '50px' }}>
              {/* Map through lines */}
              {lines.map((line, idx) => {
                const isEditing = editingIndex === idx;

                return (
                  <div
                    key={idx}
                    className="relative cursor-text border border-dashed border-gray-300"
                    style={{
                      marginLeft: '50px',  // Dialogue indent
                      width: '250px',      // Dialogue width
                      fontSize: '14px',
                      lineHeight: 1.2,
                      minHeight: '17px',  // 14px * 1.2
                      fontFamily: 'Courier New, monospace',
                      marginBottom: '4px',
                      backgroundColor: isEditing ? '#ffffcc' : 'transparent',
                    }}
                    onClick={() => setEditingIndex(idx)}
                  >
                    {isEditing ? (
                      <textarea
                        ref={(el) => {
                          if (el) autoResize(el);
                        }}
                        value={line}
                        onChange={(e) => {
                          handleChange(idx, e.target.value);
                          autoResize(e.target);
                        }}
                        className="w-full bg-transparent border-none outline-none resize-none overflow-y-hidden"
                        style={{
                          fontSize: '14px',
                          lineHeight: 1.2,
                          fontFamily: 'Courier New, monospace',
                          padding: 0,
                          margin: 0,
                          display: 'block',
                          whiteSpace: 'pre-wrap',
                          wordWrap: 'break-word',
                          overflowWrap: 'break-word',
                          wordBreak: 'break-word',
                          minHeight: '17px',
                          height: 'auto',
                          overflowX: 'hidden',
                          boxSizing: 'border-box',
                        }}
                        autoFocus
                      />
                    ) : (
                      <span
                        style={{
                          display: 'block',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {line}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-gray-50 rounded">
          <h3 className="font-bold mb-2">Debug Info:</h3>
          <pre className="text-xs">
            {JSON.stringify({ editingIndex, lineCount: lines.length }, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};
