// src/lib/i18n.ts

export type Locale = 'es' | 'en'

export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'es'
  const lang = navigator.language?.toLowerCase() ?? ''
  return lang.startsWith('es') ? 'es' : 'en'
}

export type TranslationKey = keyof typeof translations.es

const translations = {
  es: {
    // ── Dashboard ────────────────────────────────────────────
    totalSaved:           'TOTAL AHORRADO',
    of:                   'de',
    goals:                'metas',
    goal:                 'meta',
    activeGoals:          'activas',
    completed:            'completadas',
    globalPct:            'global',
    newGoal:              '+ Nueva',
    myGoals:              'Mis metas 🎯',
    noGoalsTitle:         '¡Crea tu primera meta! 🐷',
    noGoalsBody:          'Empieza guardando para algo que quieras.',
    noActiveGoals:        'No tienes metas activas',
    noCompletedGoals:     'Aún no has completado ninguna meta',
    noCategoryGoals:      'No hay metas en esta categoría',
    enableNotifs:         'Activar notificaciones push',
    disableNotifs:        'Desactivar notificaciones',

    // ── GoalCard ─────────────────────────────────────────────
    remaining:            'Faltan',
    completed_label:      '🎉 ¡Completada!',
    estimatedLabel:       'Estimado:',
    monthThisLabel:       'Este mes:',
    daysLeft:             'días',

    // ── Detail view ──────────────────────────────────────────
    back:                 '← Volver',
    edit:                 '✏️ Editar',
    addSaving:            '💰 Añadir ahorro',
    deleteGoal:           '🗑️ Eliminar meta',
    goalCompleted:        '🎉 ¡Meta completada!',
    remainingDetail:      'Faltan',
    stat_deposits:        'Depósitos',
    stat_days:            'Días ahorrando',
    stat_max:             'Mayor depósito',
    stat_avg:             'Promedio',
    savedLabel:           'ahorrado',
    remainingLabel:       'restante',
    targetLabel:          'objetivo',
    depositHistory:       'HISTORIAL DE DEPÓSITOS',
    entries:              'entradas',
    deleteDepositConfirm: (amt: number) => `¿Eliminar este depósito de €${amt}?`,
    deleteGoalConfirm:    '¿Eliminar esta meta? Esta acción no se puede deshacer.',
    monthlySection:       'META MENSUAL',
    monthCompleted:       '✅ ¡Mes completado!',

    // ── AddDepositModal ───────────────────────────────────────
    addSavingTitle:       'Añadir ahorro',
    remainingForGoal:     'Faltan para la meta',
    amountLabel:          'CANTIDAD',
    noteLabel:            'NOTA',
    noteOptional:         '(opcional)',
    cancel:               'Cancelar',
    adding:               '...',

    // ── NewGoalModal ──────────────────────────────────────────
    newGoalTitle:         'Nueva meta de ahorro ✨',
    categoryLabel:        'CATEGORÍA',
    emojiLabel:           'EMOJI',
    colorLabel:           'COLOR',
    nameLabel:            'NOMBRE',
    targetPriceLabel:     'PRECIO OBJETIVO (€)',
    initialLabel:         'YA TENGO (€)',
    monthlyTargetLabel:   'META MENSUAL (€)',
    monthlyTargetHint:    '(opcional)',
    monthlyTargetHelper:  '🔔 Recibirás un aviso push si a mitad de mes no llegas al 50%',
    creating:             'Creando...',
    createGoal:           '🎯 Crear meta',

    // ── EditGoalModal ─────────────────────────────────────────
    editGoalTitle:        'Editar meta ✏️',
    saving:               'Guardando...',
    saveChanges:          '💾 Guardar cambios',
    alreadySaved:         (amt: number) => `Ya tienes ahorrado €${amt.toLocaleString()} — el precio no puede ser menor`,
    newPriceLower:        (amt: number) => `Debe ser ≥ lo ya ahorrado (€${amt})`,

    // ── Validation ────────────────────────────────────────────
    errorNameRequired:    'El nombre es obligatorio',
    errorNameShort:       'Mínimo 2 caracteres',
    errorPriceRequired:   'El precio objetivo es obligatorio',
    errorPriceInvalid:    'Introduce un precio válido mayor que 0',
    errorPriceTooHigh:    'Precio demasiado alto',
    errorInitialInvalid:  'Introduce un valor válido',
    errorInitialTooHigh:  'No puede ser mayor o igual al precio objetivo',
    errorAmountRequired:  'Introduce una cantidad',
    errorAmountNaN:       'Solo se permiten números',
    errorAmountZero:      'La cantidad debe ser mayor que 0',
    errorAmountTooHigh:   'Cantidad demasiado grande',

    // ── Categories ────────────────────────────────────────────
    cat_todas:       'Todas',
    cat_tecnología:  'Tecnología',
    cat_viajes:      'Viajes',
    cat_moda:        'Moda',
    cat_hogar:       'Hogar',
    cat_ocio:        'Ocio',
    cat_otro:        'Otro',

    // ── Global history ────────────────────────────────────────
    historyTitle:    'Historial global 📋',
    historySubtitle: (n: number) => `${n} depósitos en total`,
    noDeposits:      'Aún no hay depósitos',

    // ── Push notifications ────────────────────────────────────
    push_inactivity_title:   (name: string, emoji: string) => `¿Sigues ahorrando para ${emoji} ${name}?`,
    push_inactivity_body:    (days: number) => `Llevas ${days} días sin registrar un ahorro. ¡Pequeños pasos cuentan!`,
    push_monthly_title:      (name: string, emoji: string) => `⚠️ Meta mensual de ${emoji} ${name}`,
    push_monthly_body:       (saved: number, target: number, daysLeft: number) => `Llevas €${saved} de €${target} este mes. Te faltan €${target - saved} y quedan ${daysLeft} días.`,
    push_milestone_title:    (pct: number, name: string, emoji: string, mEmoji: string) => `${mEmoji} ${pct}% de ${emoji} ${name}`,
    push_almost_title:       (name: string, emoji: string) => `🎯 ¡Casi lo tienes! ${emoji} ${name}`,
    push_almost_body:        (amt: number) => `Solo te faltan €${amt} para completar tu meta. ¡Un último esfuerzo!`,
    push_first_title:        (name: string, emoji: string) => `💡 ¿Empezamos? ${emoji} ${name}`,
    push_first_body:         'Creaste esta meta hace 3 días pero aún no has hecho tu primer aporte. ¡El primero es el más importante!',
    push_streak_title:       (name: string, emoji: string) => `🔥 ¡7 días seguidos! ${emoji} ${name}`,
    push_streak_body:        '¡Llevas una semana ahorrando cada día. Eso es constancia de verdad!',
    push_ahead_title:        (name: string, emoji: string) => `📈 ¡Vas muy bien! ${emoji} ${name}`,
    push_ahead_body:         (days: number) => `A este ritmo, completarás tu meta en unos ${days} días. ¡Sigue así!`,
    push_recap_title:        (month: string, name: string, emoji: string) => `📊 Resumen de ${month} — ${emoji} ${name}`,
    push_recap_body:         (saved: number, pct: number) => `Este mes ahorraste €${saved}. Llevas un ${pct}% del total. ¡Gran trabajo!`,
    push_view_goals:         'Ver metas',
    push_dismiss:            'Ignorar',
  },

  en: {
    // ── Dashboard ────────────────────────────────────────────
    totalSaved:           'TOTAL SAVED',
    of:                   'of',
    goals:                'goals',
    goal:                 'goal',
    activeGoals:          'active',
    completed:            'completed',
    globalPct:            'overall',
    newGoal:              '+ New',
    myGoals:              'My goals 🎯',
    noGoalsTitle:         'Create your first goal! 🐷',
    noGoalsBody:          'Start saving for something you want.',
    noActiveGoals:        'No active goals',
    noCompletedGoals:     "You haven't completed any goals yet",
    noCategoryGoals:      'No goals in this category',
    enableNotifs:         'Enable push notifications',
    disableNotifs:        'Disable notifications',

    // ── GoalCard ─────────────────────────────────────────────
    remaining:            'Left',
    completed_label:      '🎉 Completed!',
    estimatedLabel:       'Est.:',
    monthThisLabel:       'This month:',
    daysLeft:             'days',

    // ── Detail view ──────────────────────────────────────────
    back:                 '← Back',
    edit:                 '✏️ Edit',
    addSaving:            '💰 Add savings',
    deleteGoal:           '🗑️ Delete goal',
    goalCompleted:        '🎉 Goal completed!',
    remainingDetail:      'Left',
    stat_deposits:        'Deposits',
    stat_days:            'Days saving',
    stat_max:             'Largest deposit',
    stat_avg:             'Average',
    savedLabel:           'saved',
    remainingLabel:       'remaining',
    targetLabel:          'target',
    depositHistory:       'DEPOSIT HISTORY',
    entries:              'entries',
    deleteDepositConfirm: (amt: number) => `Delete this €${amt} deposit?`,
    deleteGoalConfirm:    'Delete this goal? This action cannot be undone.',
    monthlySection:       'MONTHLY TARGET',
    monthCompleted:       '✅ Month completed!',

    // ── AddDepositModal ───────────────────────────────────────
    addSavingTitle:       'Add savings',
    remainingForGoal:     'Remaining for goal',
    amountLabel:          'AMOUNT',
    noteLabel:            'NOTE',
    noteOptional:         '(optional)',
    cancel:               'Cancel',
    adding:               '...',

    // ── NewGoalModal ──────────────────────────────────────────
    newGoalTitle:         'New savings goal ✨',
    categoryLabel:        'CATEGORY',
    emojiLabel:           'EMOJI',
    colorLabel:           'COLOR',
    nameLabel:            'NAME',
    targetPriceLabel:     'TARGET PRICE (€)',
    initialLabel:         'ALREADY HAVE (€)',
    monthlyTargetLabel:   'MONTHLY TARGET (€)',
    monthlyTargetHint:    '(optional)',
    monthlyTargetHelper:  "🔔 You'll get a push alert if you're below 50% by mid-month",
    creating:             'Creating...',
    createGoal:           '🎯 Create goal',

    // ── EditGoalModal ─────────────────────────────────────────
    editGoalTitle:        'Edit goal ✏️',
    saving:               'Saving...',
    saveChanges:          '💾 Save changes',
    alreadySaved:         (amt: number) => `You've already saved €${amt.toLocaleString()} — target can't be lower`,
    newPriceLower:        (amt: number) => `Must be ≥ already saved (€${amt})`,

    // ── Validation ────────────────────────────────────────────
    errorNameRequired:    'Name is required',
    errorNameShort:       'At least 2 characters',
    errorPriceRequired:   'Target price is required',
    errorPriceInvalid:    'Enter a valid price greater than 0',
    errorPriceTooHigh:    'Price is too high',
    errorInitialInvalid:  'Enter a valid value',
    errorInitialTooHigh:  'Cannot be equal to or greater than the target price',
    errorAmountRequired:  'Enter an amount',
    errorAmountNaN:       'Numbers only',
    errorAmountZero:      'Amount must be greater than 0',
    errorAmountTooHigh:   'Amount is too large',

    // ── Categories ────────────────────────────────────────────
    cat_todas:       'All',
    cat_tecnología:  'Tech',
    cat_viajes:      'Travel',
    cat_moda:        'Fashion',
    cat_hogar:       'Home',
    cat_ocio:        'Leisure',
    cat_otro:        'Other',

    // ── Global history ────────────────────────────────────────
    historyTitle:    'Global history 📋',
    historySubtitle: (n: number) => `${n} deposits total`,
    noDeposits:      'No deposits yet',

    // ── Push notifications ────────────────────────────────────
    push_inactivity_title:   (name: string, emoji: string) => `Still saving for ${emoji} ${name}?`,
    push_inactivity_body:    (days: number) => `You haven't saved in ${days} days. Small steps count!`,
    push_monthly_title:      (name: string, emoji: string) => `⚠️ Monthly target for ${emoji} ${name}`,
    push_monthly_body:       (saved: number, target: number, daysLeft: number) => `You've saved €${saved} of €${target} this month. €${target - saved} to go, ${daysLeft} days left.`,
    push_milestone_title:    (pct: number, name: string, emoji: string, mEmoji: string) => `${mEmoji} ${pct}% of ${emoji} ${name}`,
    push_almost_title:       (name: string, emoji: string) => `🎯 Almost there! ${emoji} ${name}`,
    push_almost_body:        (amt: number) => `Only €${amt} left to complete your goal. One final push!`,
    push_first_title:        (name: string, emoji: string) => `💡 Let's get started! ${emoji} ${name}`,
    push_first_body:         "You created this goal 3 days ago but haven't made your first deposit yet. The first one's the hardest!",
    push_streak_title:       (name: string, emoji: string) => `🔥 7 days in a row! ${emoji} ${name}`,
    push_streak_body:        "You've saved every day for a week. That's real commitment!",
    push_ahead_title:        (name: string, emoji: string) => `📈 You're on track! ${emoji} ${name}`,
    push_ahead_body:         (days: number) => `At this rate you'll hit your goal in about ${days} days. Keep it up!`,
    push_recap_title:        (month: string, name: string, emoji: string) => `📊 ${month} recap — ${emoji} ${name}`,
    push_recap_body:         (saved: number, pct: number) => `You saved €${saved} this month. You're at ${pct}% overall. Great work!`,
    push_view_goals:         'View goals',
    push_dismiss:            'Dismiss',
  },
} as const

export type T = typeof translations.es

export function getT(locale: Locale): T {
  return translations[locale] as unknown as T
}
