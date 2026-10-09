import React from "react";
import { createRoot } from "react-dom/client";
import ReceptionistMerchant from "./game/mayhem/ReceptionistMerchant";

const host = document.createElement("div");
host.id = "merchant-probe";
document.body.appendChild(host);
createRoot(host).render(
  <ReceptionistMerchant
    seen={false}
    freeUsed={false}
    purchased={[]}
    paused={false}
    onSeen={() => undefined}
    onBuy={() => undefined}
    onClose={() => undefined}
  />,
);
(window as unknown as { __probeReady: boolean }).__probeReady = true;
