// AlgoPlay Internationalization & Localization Helper
(function() {
  const translations = {
    en: {
      continue_learning: "Continue learning →",
      science_title: "🧪 Science — Experiments",
      science_desc: "Physics, Chemistry & Biology · 8 lessons",
      tech_title: "💻 Technology — Coding & Logic",
      tech_desc: "Interactive coding tasks",
      btn_achievements: "🏆 Achievements",
      btn_logout: "Logout",
      chat_with_ai: "Chat with AI"
    }
  };

  function applyLanguage(lang) {
    const dict = translations[lang] || translations.en;
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (dict[key]) {
        el.textContent = dict[key];
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const currentLang = localStorage.getItem("algoplay_lang") || "en";
    applyLanguage(currentLang);
  });

  window.setLanguage = applyLanguage;
})();
