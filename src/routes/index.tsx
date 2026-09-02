import { createFileRoute } from "@tanstack/react-router";
import { CityGame } from "@/components/game/CityGame";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Metrópole — City Builder em Visão Superior" },
      {
        name: "description",
        content:
          "Construa ruas, zoneie casas, lojas e indústrias e veja sua cidade crescer com simulação de demanda, energia e serviços públicos.",
      },
      { property: "og:title", content: "Metrópole — City Builder em Visão Superior" },
      {
        property: "og:description",
        content:
          "Simulador de cidade estilo SimCity: ruas, zonas residenciais, comerciais e industriais com dinâmica real de crescimento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CityGame,
});
