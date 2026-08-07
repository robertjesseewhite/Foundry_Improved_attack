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
 * Handle rolling the attack, checking for critical hits, and automatically rolling damage.
 * @param {ChatMessage} message The origin chat message
 * @param {Event} event The click event
 */
async function rollAttackAndDamage(message, event) {
  let activity = message.activity;
  let item = message.item;
  
  // Try to find the card and buttons in the DOM from the clicked button event
  const $btn = $(event.currentTarget);
  const $card = $btn.closest('.chat-card, .dnd5e.chat-card, .message-content');
  const attackBtn = $card.find('[data-action*="attack"], [data-action*="Attack"]').not('.improved-attack-damage-btn');
  const damageBtn = $card.find('[data-action*="damage"], [data-action*="Damage"]').not('.improved-attack-damage-btn');
  
  console.log("Improved Attack & Damage | DOM search results: card =", $card.length, "attackBtn =", attackBtn.length, "damageBtn =", damageBtn.length);
  
  // 1. Resolve via DOM data-uuid attributes (extremely robust for modern dnd5e)
  if (!activity) {
    const attackUuid = attackBtn.attr("data-uuid") || attackBtn.attr("data-activity-uuid");
    const damageUuid = damageBtn.attr("data-uuid") || damageBtn.attr("data-activity-uuid");
    console.log("Improved Attack & Damage | DOM data-uuids: attack =", attackUuid, ", damage =", damageUuid);
    
    if (attackUuid) {
      const doc = await fromUuid(attackUuid);
      if (doc) {
        if (doc.type === "attack" || typeof doc.rollAttack === "function") {
          activity = doc;
        } else {
          item = doc;
        }
      }
    }
    
    if (!activity && damageUuid) {
      const doc = await fromUuid(damageUuid);
      if (doc) {
        if (doc.type === "attack" || typeof doc.rollAttack === "function") {
          activity = doc;
        } else if (!item) {
          item = doc;
        }
      }
    }
  }

  // 2. Fallback: retrieve the activity via flags if not resolved yet
  if (!activity) {
    const activityUuid = message.getFlag("dnd5e", "activityUuid") || message.flags?.dnd5e?.activityUuid;
    if (activityUuid) {
      activity = await fromUuid(activityUuid);
    }
  }

  // 3. Fallback: retrieve the item via flags if not resolved yet
  if (!activity && !item) {
    const itemUuid = message.getFlag("dnd5e", "itemUuid") || message.flags?.dnd5e?.itemUuid || message.getFlag("dnd5e", "uuid");
    if (itemUuid) {
      item = await fromUuid(itemUuid);
    }
  }

  // 4. Fallback: find the first attack activity on the item
  if (!activity && item) {
    if (item.system.activities) {
      activity = item.system.activities.find(a => a.type === "attack");
    } else {
      activity = item;
    }
  }

  if (!activity) {
    ui.notifications.warn("Improved Attack & Damage | Could not resolve item or activity for this card.");
    return;
  }

  // 3. Roll the Attack
  if (typeof activity.rollAttack !== "function") {
    ui.notifications.warn("Improved Attack & Damage | This action does not support attack rolls.");
    return;
  }

  // Roll the attack (retaining key modifier state like Shift/Alt via event)
  const attackRolls = await activity.rollAttack({ event });
  if (!attackRolls) return; // Roll cancelled or aborted

  // Get the main roll from the array or object
  const roll = Array.isArray(attackRolls) ? attackRolls[0] : attackRolls;
  if (!roll) return;

  // 4. Check for Critical Hit
  let isCritical = false;
  if (typeof roll.isCritical === "boolean") {
    isCritical = roll.isCritical;
  } else if (typeof roll.isCritical === "function") {
    isCritical = roll.isCritical();
  } else {
    isCritical = !!roll.isCritical;
  }

  // 5. Roll the Damage
  if (typeof activity.rollDamage === "function") {
    const damageOptions = {
      event,
      critical: isCritical,
      isCritical: isCritical,
      fastForward: true // Auto roll damage without prompting with a second dialog
    };
    await activity.rollDamage(damageOptions);
  } else {
    ui.notifications.warn("Improved Attack & Damage | This action does not support damage rolls.");
  }
}
