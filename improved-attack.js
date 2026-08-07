Hooks.once("init", () => {
  console.log("Improved Attack & Damage Roll | Initialized");
});

function onRenderChatMessage(message, html, data) {
  // Wrap in jQuery to support both V11/V12 (jQuery object) and V13/V14 (HTMLElement)
  const $html = (html instanceof HTMLElement) ? $(html) : html;
  
  // Find standard attack and damage buttons
  const attackBtn = $html.find('button[data-action="rollAttack"], button[data-action="attack"]');
  const damageBtn = $html.find('button[data-action="rollDamage"], button[data-action="damage"]');
  
  // If both exist, we add our combined Attack & Damage button
  if (attackBtn.length && damageBtn.length) {
    if ($html.find('button[data-action="rollAttackAndDamage"]').length === 0) {
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
        
        await rollAttackAndDamage(message, event);
      });
    }
  }
}

Hooks.on("renderChatMessage", onRenderChatMessage);
Hooks.on("renderChatMessageHTML", onRenderChatMessage);

/**
 * Handle rolling the attack, checking for critical hits, and automatically rolling damage.
 * @param {ChatMessage} message The origin chat message
 * @param {Event} event The click event
 */
async function rollAttackAndDamage(message, event) {
  let activity = null;
  
  // 1. Attempt to retrieve the activity via activityUuid
  const activityUuid = message.getFlag("dnd5e", "activityUuid") || message.flags?.dnd5e?.activityUuid;
  if (activityUuid) {
    activity = await fromUuid(activityUuid);
  }

  // 2. Fallback: retrieve the item and locate its attack activity
  if (!activity) {
    const itemUuid = message.getFlag("dnd5e", "itemUuid") || message.flags?.dnd5e?.itemUuid || message.getFlag("dnd5e", "uuid");
    if (itemUuid) {
      const item = await fromUuid(itemUuid);
      if (item) {
        if (item.system.activities) {
          activity = item.system.activities.find(a => a.type === "attack");
        } else {
          activity = item;
        }
      }
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
