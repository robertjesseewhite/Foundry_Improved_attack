Hooks.once("init", () => {
  console.log("Improved Attack & Damage Roll | Initialized");
  
  // Register the system-specific hook for dnd5e to ensure buttons persist in activity usage cards
  Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);
});

function onRenderChatMessage(message, html, data) {
  console.log("Improved Attack & Damage | onRenderChatMessage triggered for message:", message.id);
  
  // Wrap in jQuery to support both V11/V12 (jQuery object) and V13/V14 (HTMLElement)
  const $html = (html instanceof HTMLElement) ? $(html) : html;
  
  // Find standard attack and damage elements using wildcard selectors (excluding our custom button)
  const attackBtn = $html.find('[data-action*="attack"], [data-action*="Attack"]').not('.improved-attack-damage-btn');
  const damageBtn = $html.find('[data-action*="damage"], [data-action*="Damage"]').not('.improved-attack-damage-btn');
  
  console.log("Improved Attack & Damage | Elements found: attack =", attackBtn.length, ", damage =", damageBtn.length);
  
  // If both exist, we add our combined Attack & Damage button
  if (attackBtn.length && damageBtn.length) {
    if ($html.find('[data-action="rollAttackAndDamage"]').length === 0) {
      console.log("Improved Attack & Damage | Injecting ATTACK & DAMAGE button");
      const newBtn = $(`
        <button data-action="rollAttackAndDamage" class="improved-attack-damage-btn">
          <i class="fa-solid fa-dice-d20"></i> ATTACK & DAMAGE
        </button>
      `);
      
      // Place it after the damage button
      damageBtn.after(newBtn);
      
      // Bind the click handler to run both rolls sequentially
      newBtn.on("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        console.log("Improved Attack & Damage | ATTACK & DAMAGE button clicked");
        await rollAttackAndDamage(message, event);
      });
    }
  }
}

/**
 * Handle rolling the attack and damage sequentially by triggering the card's native buttons.
 * @param {ChatMessage} message The origin chat message
 * @param {Event} event The click event
 */
async function rollAttackAndDamage(message, event) {
  console.log("Improved Attack & Damage | Triggering combined roll for message:", message.id);
  
  // Locate the parent chat message container in the DOM
  const $btn = $(event.currentTarget);
  const $card = $btn.closest('[data-message-id], .chat-message, .message, .chat-card');
  
  // Locate the standard ATTACK and DAMAGE buttons on this card
  const attackBtn = $card.find('[data-action*="attack"], [data-action*="Attack"]').not('.improved-attack-damage-btn');
  const damageBtn = $card.find('[data-action*="damage"], [data-action*="Damage"]').not('.improved-attack-damage-btn');
  
  if (!attackBtn.length || !damageBtn.length) {
    ui.notifications.warn("Improved Attack & Damage | Could not locate standard Attack or Damage buttons on this card.");
    return;
  }
  
  const isAdvantage = event.ctrlKey || event.metaKey;
  const isDisadvantage = event.altKey;

  // 1. Trigger standard Attack button (fast-forwarded to bypass dialog)
  console.log("Improved Attack & Damage | Triggering fast-forwarded Attack roll...");
  const attackMouseEvent = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    view: window,
    shiftKey: !isAdvantage && !isDisadvantage, // Fast-forward normal roll
    altKey: isDisadvantage,                    // Fast-forward disadvantage
    ctrlKey: isAdvantage,                      // Fast-forward advantage
    metaKey: isAdvantage
  });
  attackBtn[0].dispatchEvent(attackMouseEvent);
  
  // 2. Trigger standard Damage button (fast-forwarded to bypass dialog)
  setTimeout(() => {
    console.log("Improved Attack & Damage | Triggering fast-forwarded Damage roll...");
    const damageMouseEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
      shiftKey: true // Fast-forward damage roll without dialog
    });
    damageBtn[0].dispatchEvent(damageMouseEvent);
  }, 300);
}
