import { useEffect, useState } from "react";
import { useApp } from "./product/store";
import { Header, LiveTicker, MobileNav, Footer, Toasts } from "./product/shell";
import { HomePage, BankPage, VariantsPage, RunPage, ResultsPage, ProbabilityPage } from "./product/pages";
import { AnalyticsPage, RatingPage, MistakesPage, AdminPage } from "./product/pages2";
import TrainerPage from "./product/TrainerPage";
import PublishedVariantRunner from "./product/PublishedVariantRunner";
import MarathonPage from "./product/MarathonPage";
import { ConfettiBurst, FieldDockProvider } from "./product/ui";
import AuthModal from "./product/AuthModal";
import LegalModal, { type LegalDoc } from "./product/LegalDocs";
import ForgotPasswordModal from "./product/ForgotPassword";
import VkContactWidget from "./product/VkContactWidget";

export default function App() {
  const { route, burst, runPublishedVariant } = useApp();
  const [authOpen, setAuthOpen] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);

  /* окно входа открывается по событию из шапки */
  useEffect(() => {
    const onLogin = () => setAuthOpen(true);
    window.addEventListener("komi:login", onLogin);
    return () => window.removeEventListener("komi:login", onLogin);
  }, []);

  /* глубокая ссылка на авторский вариант: ?variant=VAR-XXXXXX */
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("variant");
    if (code && code.trim()) {
      const ok = runPublishedVariant(code.trim());
      if (!ok) {
        /* вариант ещё не опубликован на этом устройстве — просто очищаем параметр */
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* юридические документы открываются по событию из футера */
  useEffect(() => {
    const onLegal = (e: Event) => setLegalDoc((e as CustomEvent<LegalDoc>).detail ?? "privacy");
    window.addEventListener("komi:legal", onLegal);
    return () => window.removeEventListener("komi:legal", onLegal);
  }, []);

  return (
    <FieldDockProvider>
      <div className="min-h-screen font-body text-chalk-200">
        <div className="noise-overlay" aria-hidden="true" />
        <Header />
        {route !== "run" && <LiveTicker />}

        <main key={route} className="page-in pb-24 md:pb-16">
          {route === "home" && <HomePage />}
          {route === "bank" && <BankPage />}
          {route === "trainer" && <TrainerPage />}
          {route === "variants" && <VariantsPage />}
          {route === "variant-run" && <PublishedVariantRunner />}
          {route === "marathon" && <MarathonPage />}
          {route === "run" && <RunPage />}
          {route === "results" && <ResultsPage />}
          {route === "probability" && <ProbabilityPage />}
          {route === "analytics" && <AnalyticsPage />}
          {route === "rating" && <RatingPage />}
          {route === "mistakes" && <MistakesPage />}
          {route === "admin" && <AdminPage />}
          {route === "achieve" && <RatingPage />}
        </main>

        {/* Виджет обратной связи ВК — скрыт во время решения варианта и в кабинете */}
        {route !== "run" && route !== "variant-run" && route !== "admin" && <VkContactWidget />}

        <Footer />
        <MobileNav />
        <Toasts />
        <ConfettiBurst burst={burst} />
        <AuthModal
          open={authOpen}
          onClose={() => setAuthOpen(false)}
          onOpenLegal={setLegalDoc}
          onForgot={() => { setAuthOpen(false); setForgotOpen(true); }}
        />
        <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
        <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} />
      </div>
    </FieldDockProvider>
  );
}
