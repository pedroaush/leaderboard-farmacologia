/**
 * VLibrasWidget — injeta o widget oficial do VLibras (governo brasileiro,
 * https://www.gov.br/governodigital/pt-br/vlibras) na página. Precisa
 * carregar o script externo e criar a estrutura HTML exigida por ele.
 *
 * Montado uma vez no App.tsx, aparece em toda a plataforma.
 */
import { useEffect } from "react";

declare global {
  interface Window {
    VLibras?: {
      Widget: new (url: string) => void;
    };
  }
}

export default function VLibrasWidget() {
  useEffect(() => {
    // Evita duplicar se o componente remontar (ex: hot reload em dev)
    if (document.getElementById("vlibras-script")) return;

    const script = document.createElement("script");
    script.id = "vlibras-script";
    script.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
    script.async = true;
    script.onload = () => {
      if (window.VLibras) {
        new window.VLibras.Widget("https://vlibras.gov.br/app");
      }
    };
    document.body.appendChild(script);

    return () => {
      // Não remove o script no cleanup — o VLibras não foi feito pra ser
      // desmontado/remontado repetidamente, e como isso só monta 1 vez no
      // App.tsx (nível raiz), não há necessidade real de limpeza aqui.
    };
  }, []);

  return (
    <div vw="true" className="enabled">
      <div vw-access-button="true" className="active" />
      <div vw-plugin-wrapper="true">
        <div className="vw-plugin-top-wrapper" />
      </div>
    </div>
  );
}
