const { applyAutofillHighlight, DRAWABLE_XML } = require("../plugins/withAutofillHighlight");

// styles.xml as prebuild generates it, already parsed.
const stylesXml = () => ({
  resources: {
    style: [
      {
        $: { name: "AppTheme", parent: "Theme.AppCompat.DayNight.NoActionBar" },
        item: [{ $: { name: "colorPrimary" }, _: "@color/colorPrimary" }],
      },
      {
        $: { name: "Theme.App.SplashScreen", parent: "Theme.SplashScreen" },
        item: [{ $: { name: "postSplashScreenTheme" }, _: "@style/AppTheme" }],
      },
    ],
  },
});

const highlightItems = (xml, theme = "AppTheme") =>
  xml.resources.style
    .find((s) => s.$.name === theme)
    .item.filter((i) => i.$.name === "android:autofilledHighlight");

describe("withAutofillHighlight", () => {
  it("points AppTheme's autofill highlight at the pill drawable", () => {
    const items = highlightItems(applyAutofillHighlight(stylesXml()));
    expect(items).toHaveLength(1);
    expect(items[0]._).toBe("@drawable/autofill_highlight");
    expect(items[0].$["tools:targetApi"]).toBe("26");
  });

  it("doesn't add a second item when prebuild runs again", () => {
    const xml = applyAutofillHighlight(applyAutofillHighlight(stylesXml()));
    expect(highlightItems(xml)).toHaveLength(1);
    expect(highlightItems(xml, "Theme.App.SplashScreen")).toHaveLength(0);
  });

  // Android clamps a corner radius to half the shorter side, so this is a pill
  // on any field; the colour stays Android's own autofill yellow.
  it("draws a pill in Android's autofill yellow", () => {
    expect(DRAWABLE_XML).toContain('<corners android:radius="999dp" />');
    expect(DRAWABLE_XML).toContain('<solid android:color="#4DFFEB3B" />');
  });
});
