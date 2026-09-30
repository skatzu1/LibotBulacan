/**
 * Which AR model — if any — is allowed on screen right now.
 *
 * A spot's `modelsCoordinates` is a numbered trail, not a set. The moderator
 * lists the models in the order they are meant to be found, and that is the
 * order they appear in: first, then second, then last. Nothing is skipped,
 * nothing is chosen by proximity, and nothing that has been explored ever
 * comes back.
 *
 * This lives outside ARScreen because it is the one rule the whole screen
 * agrees on — the renderer, the radar, the step card and the arrival flash all
 * read from it — and because a rule with this many edge cases is worth being
 * able to test without a phone in your hand.
 */

/**
 * @param {Array<{index:number, label:string, distance:number, radius:number, isInRange:boolean}>} anchorProximities
 *        Every anchor at this spot with its current distance, as produced by
 *        computeAnchorProximities. Sorted by DISTANCE, which is why this
 *        re-sorts by `index`.
 * @param {Set<number>} tappedIndices  Anchors already explored this session.
 * @param {boolean} triviaVisible      Is a trivia card currently open?
 *
 * @returns {{next: object|null, inRange: boolean, focus: object|null, pending: object|null}}
 *  - `next`    the anchor whose turn it is, explored or not in range or not
 *  - `inRange` is the user standing close enough for THAT anchor
 *  - `focus`   the anchor to actually render, or null to render nothing
 *  - `pending` set when the next anchor is out of range — what to point at
 */
export function resolveTrail(anchorProximities, tappedIndices, triviaVisible) {
  const next =
    [...(anchorProximities ?? [])]
      .sort((a, b) => a.index - b.index)
      .find((a) => !tappedIndices.has(a.index)) ?? null;

  // Deliberately asks about that ONE anchor, not "is any anchor nearby".
  // Standing on top of the third model while the first is still unexplored is
  // not being in range — the trail is in order.
  const inRange = !!next?.isInRange;

  return {
    next,
    inRange,

    // The `!triviaVisible` term is what stops the models overlapping in time.
    // Tapping one removes it from the trail immediately, so without this the
    // next model would mount behind the trivia card and be standing there,
    // already placed, the moment the card was dismissed. Held back until the
    // card closes, each object gets the screen to itself.
    focus: inRange && !triviaVisible ? next : null,

    pending: next && !inRange ? next : null,
  };
}

/**
 * The one trivia fact a model reveals when it is found.
 *
 * Model n on the trail shows fact n, so walking the whole trail reads the
 * facts in the order the moderator wrote them. A spot with more models than
 * facts wraps back to the first; a spot with no facts gets a generic line
 * rather than an empty card.
 *
 * @param {string[]|undefined} trivia  The spot's trivia, in order.
 * @param {number} index               The model's position on the trail (0-based).
 * @param {string} [spotName]          Only used for the no-trivia fallback.
 * @returns {string}
 */
export function triviaForModel(trivia, index, spotName) {
  const facts = (trivia ?? []).filter((t) => typeof t === "string" && t.trim());
  if (!facts.length) return `${spotName ?? "This spot"} is a remarkable place worth exploring!`;
  const i = Number.isInteger(index) && index >= 0 ? index : 0;
  return facts[i % facts.length];
}
