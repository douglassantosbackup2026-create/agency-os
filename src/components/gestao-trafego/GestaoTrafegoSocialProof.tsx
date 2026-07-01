import { GestaoResultsGallery, GestaoSocialProof } from "@/components/gestao/GestaoCheckoutBlocks";
import { anchors } from "@/content/gestao-trafego";

export function GestaoTrafegoSocialProof() {
  return (
    <section id={anchors.prova} className="border-t border-border/60 py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <GestaoResultsGallery />
          </div>
          <div className="space-y-6">
            <GestaoSocialProof />
          </div>
        </div>
      </div>
    </section>
  );
}

