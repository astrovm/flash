import { createProgramRoot } from "../ui.js";

export const renderIdDiskDefragmenter = (context, program, programId) => {
  const content = createProgramRoot(program);

  content.innerHTML = `<div class="xp-defrag-volume"><table><thead><tr><th>Volume</th><th>File System</th><th>Capacity</th><th>Free Space</th><th>% Free Space</th></tr></thead><tbody><tr class="selected"><td>(C:)</td><td>NTFS</td><td>20.00 GB</td><td>12.34 GB</td><td>61%</td></tr></tbody></table></div><div class="xp-defrag-legend"><span><i class="fragmented"></i> Fragmented files</span><span><i class="contiguous"></i> Contiguous files</span><span><i class="system"></i> System files</span><span><i class="free"></i> Free space</span></div><section class="xp-defrag-map"><h3>Estimated disk usage before defragmentation:</h3><div data-defrag-before></div><h3>Estimated disk usage after defragmentation:</h3><div data-defrag-after></div></section><p class="xp-program-status" aria-live="polite">Select a volume and click Analyze.</p><div class="xp-defrag-actions"><button type="button" data-defrag-analyze>Analyze</button><button type="button" data-defrag-run disabled>Defragment</button></div>`;
  const before = content.querySelector("[data-defrag-before]");
  const after = content.querySelector("[data-defrag-after]");
  const status = content.querySelector(".xp-program-status");
  const runButton = content.querySelector("[data-defrag-run]");
  const blocks = [
    "contiguous",
    "contiguous",
    "fragmented",
    "free",
    "system",
    "fragmented",
    "contiguous",
    "free",
    "fragmented",
    "free",
    "contiguous",
    "free",
    "system",
    "free",
    "free",
    "contiguous",
  ];
  const renderMap = (target, layout) => {
    target.replaceChildren(
      ...layout.map((type) => {
        const block = document.createElement("i");
        block.className = type;
        return block;
      }),
    );
  };
  renderMap(before, blocks);
  renderMap(after, Array(16).fill("free"));
  content
    .querySelector("[data-defrag-analyze]")
    .addEventListener("click", () => {
      status.textContent =
        "Analysis is complete. You should defragment this volume.";
      runButton.disabled = false;
    });
  runButton.addEventListener("click", () => {
    renderMap(after, [
      ...Array(7).fill("contiguous"),
      ...Array(2).fill("system"),
      ...Array(7).fill("free"),
    ]);
    status.textContent = "Defragmentation is complete for Local Disk (C:).";
    runButton.disabled = true;
  });
  return content;
};
