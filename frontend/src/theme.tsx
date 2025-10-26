import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react"
import { buttonRecipe } from "./theme/button.recipe"

const config = defineConfig({
  globalCss: {
    html: {
      fontSize: "16px",
      height: "100%",
    },
    body: {
      fontSize: "1rem",
      margin: 0,
      padding: 0,
      height: "100%",
      bg: "#F4ECD8",
      color: "#3A3A3A",
      fontFamily: "'Crimson Text', serif",
    },
    "#root": {
      height: "100%",
    },
    ".main-link": {
      color: "ui.main",
      fontWeight: "bold",
    },
  },
  theme: {
    tokens: {
      colors: {
        ui: {
          main: { value: "#748E54" },
        },
        sepia: {
          bg: { value: "#F4ECD8" },
        },
        darkGrey: {
          text: { value: "#3A3A3A" },
        },
        salmon: {
          500: { value: "#E07A5F" },
          600: { value: "#D46A4D" },
        },
        slate: {
          500: { value: "#9FA0C3" },
          600: { value: "#8F90B3" },
        },
        olive: {
          500: { value: "#748E54" },
        },
      },
      fonts: {
        body: { value: "'Crimson Text', serif" },
        heading: { value: "'Crimson Text', serif" },
      },
    },
    recipes: {
      button: buttonRecipe,
    },
  },
})

export const system = createSystem(defaultConfig, config)
