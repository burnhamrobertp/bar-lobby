// SPDX-FileCopyrightText: 2026 The BAR Lobby Authors
//
// SPDX-License-Identifier: MIT

import { StringDecoder } from "string_decoder";

// The engine stacktrace translator (https://github.com/beyond-all-reason/stacktrace_translator)
// anchors its patterns to the start of a line, so engine output must never be cut mid-line.
export function collectCompleteLines(onLines: (lines: string) => void) {
    const decoder = new StringDecoder("utf8");
    let partialLine = "";

    return {
        write(chunk: Buffer) {
            const text = partialLine + decoder.write(chunk);
            const lastLineBreak = text.lastIndexOf("\n");

            if (lastLineBreak === -1) {
                partialLine = text;

                return;
            }

            partialLine = text.slice(lastLineBreak + 1);
            onLines(text.slice(0, lastLineBreak));
        },

        flush() {
            const text = partialLine + decoder.end();
            partialLine = "";

            if (text) onLines(text);
        },
    };
}
