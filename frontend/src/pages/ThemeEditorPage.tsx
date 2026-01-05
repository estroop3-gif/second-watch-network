/**
 * ThemeEditorPage
 * Full page theme editor accessible from settings
 */

import React from 'react';
import { ThemeEditor } from '@/components/theme-editor';

export default function ThemeEditorPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <ThemeEditor />
    </div>
  );
}
