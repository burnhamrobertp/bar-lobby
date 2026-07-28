// SPDX-FileCopyrightText: 2026 The BAR Lobby Authors
//
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";

import { collectCompleteLines } from "@main/utils/line-collector";

function feedInChunks(text: string, chunkSize: number) {
    const emitted: string[] = [];
    const collector = collectCompleteLines((lines) => emitted.push(lines));

    const buffer = Buffer.from(text, "utf8");
    for (let offset = 0; offset < buffer.length; offset += chunkSize) {
        collector.write(buffer.subarray(offset, offset + chunkSize));
    }
    collector.flush();

    return emitted;
}

const stacktrace = [
    "[t=00:16:27.100699][f=0028231] Error: Spring 2026.06.12 has crashed.",
    "[t=00:16:27.134599][f=0028231] Error: 0x00007ff76cb50000\tspring",
    "[t=00:16:27.135250][f=0028231] Error: Stacktrace for Spring 2026.06.12:",
    "[t=00:16:27.135603][f=0028231] Error: \t(0) C:\\engine\\recoil_2026.06.12\\spring.exe [0x00007ff76d252611]",
    "[t=00:16:27.135610][f=0028231] Error: \t(1) C:\\engine\\recoil_2026.06.12\\spring.exe [0x00007ff76d253a15]",
].join("\n");

describe("collectCompleteLines", () => {
    it("never starts an emission mid-line, whatever the chunk size", () => {
        for (let chunkSize = 1; chunkSize <= stacktrace.length + 1; chunkSize++) {
            const emitted = feedInChunks(`${stacktrace}\n`, chunkSize);

            expect(emitted.join("\n").split("\n")).toEqual(stacktrace.split("\n"));
        }
    });

    it("emits a trailing line without a newline only on flush", () => {
        const emitted: string[] = [];
        const collector = collectCompleteLines((lines) => emitted.push(lines));

        collector.write(Buffer.from("[t=00:00:00.1] Error: no trailing newline"));
        expect(emitted).toEqual([]);

        collector.flush();
        expect(emitted).toEqual(["[t=00:00:00.1] Error: no trailing newline"]);
    });

    it("keeps multi-byte characters intact across chunk boundaries", () => {
        const line = "[t=00:00:00.1] player joined: Ünïcödé ✓\n";
        const buffer = Buffer.from(line, "utf8");

        for (let split = 1; split < buffer.length; split++) {
            const emitted: string[] = [];
            const collector = collectCompleteLines((lines) => emitted.push(lines));

            collector.write(buffer.subarray(0, split));
            collector.write(buffer.subarray(split));
            collector.flush();

            expect(emitted.join("")).toEqual(line.trimEnd());
        }
    });
});
