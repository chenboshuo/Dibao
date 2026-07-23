# Problem: Survey-based source preference + content depth scoring

The current source preference system relies entirely on implicit signals (opens, likes, unlikes, scroll depth). This has several limitations:

1. **"Like" is a single dimension** — a user might like a source's topics but find it publishes too frequently (too much), or respect a source's quality but read it rarely (too little). The like/unlike button cannot express this nuance.

2. **No content depth signal** — a source that publishes long-form investigative reports (high depth) competes for slots against sources that publish short news blips (low depth). The algorithm has no way to prefer quality over quantity.

3. **Volume-based distortion** — a high-volume feed with moderate engagement can crowd out a low-volume feed with high engagement. The `sourceScoringMode` from [0001](../0001_source_diversity/) partially addresses this via ratio mode, but ratio mode is still based on the same implicit signals — it normalizes by volume but doesn't capture the user's meta-judgment about the source itself.
