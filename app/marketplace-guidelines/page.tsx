"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFeatherPointed, faArrowLeft } from "@fortawesome/free-solid-svg-icons";

const tocItems = [
  { id: "introduction", label: "Introduction" },
  { id: "seller-eligibility", label: "Seller Eligibility" },
  { id: "allowed-products", label: "Allowed Products" },
  { id: "prohibited-items", label: "Prohibited Items" },
  { id: "listing-products", label: "Listing Products" },
  { id: "images-descriptions", label: "Images & Descriptions" },
  { id: "pricing-fees", label: "Pricing & Fees" },
  { id: "physical-products", label: "Physical Products" },
  { id: "digital-products", label: "Digital Products" },
  { id: "payments", label: "Payments" },
  { id: "taxes-compliance", label: "Taxes & Compliance" },
  { id: "buyer-protection", label: "Buyer Protection" },
  { id: "seller-protection", label: "Seller Protection" },
  { id: "disputes-refunds", label: "Disputes & Refunds" },
  { id: "reviews-ratings", label: "Reviews & Ratings" },
  { id: "intellectual-property", label: "Intellectual Property" },
  { id: "account-standing", label: "Account Standing" },
  { id: "violations", label: "Violations & Enforcement" },
  { id: "changes", label: "Changes to Guidelines" },
  { id: "contact", label: "Contact & Support" },
];

export default function MarketplaceGuidelinesPage() {
  const lastUpdated = "February 2, 2026";
  const [activeSection, setActiveSection] = useState("introduction");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    tocItems.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#FDFCFB]">
      {/* Minimal Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#FDFCFB]/90 backdrop-blur-md border-b border-black/[0.04]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted hover:text-ink transition-colors group"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span className="font-ui text-sm">Back</span>
          </Link>
          <Link href="/" className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
            <FontAwesomeIcon icon={faFeatherPointed} className="w-4 h-4 text-purple-primary" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-[680px] mx-auto text-center lg:ml-[280px] xl:mx-auto">
          <p className="font-ui text-[0.7rem] tracking-[0.2em] uppercase text-muted mb-6">
            Marketplace
          </p>
          <h1 className="font-display text-5xl md:text-6xl font-normal mb-6 leading-[1.1]">
            <span className="bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm bg-clip-text text-transparent">
              Marketplace Guidelines
            </span>
          </h1>
          <p className="font-body text-lg text-muted/80 italic">
            Last updated {lastUpdated}
          </p>
        </div>
      </section>

      {/* Decorative Divider */}
      <div className="flex items-center justify-center gap-3 pb-16 lg:ml-[280px] xl:ml-0">
        <span className="w-12 h-px bg-gradient-to-r from-transparent to-purple-primary/30" />
        <FontAwesomeIcon icon={faFeatherPointed} className="w-4 h-4 text-purple-primary/40" />
        <span className="w-12 h-px bg-gradient-to-l from-transparent to-purple-primary/30" />
      </div>

      <div className="flex max-w-5xl mx-auto px-6">
        {/* Sidebar Navigation */}
        <aside className="hidden lg:block w-[200px] flex-shrink-0">
          <nav className="sticky top-24">
            <p className="font-ui text-[0.6rem] tracking-[0.2em] uppercase text-muted/60 mb-4">
              On this page
            </p>
            <ul className="space-y-1">
              {tocItems.map(({ id, label }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className={`group flex items-center gap-2 py-1.5 text-sm transition-all duration-200 ${
                      activeSection === id
                        ? "text-purple-primary font-medium"
                        : "text-muted/70 hover:text-ink"
                    }`}
                  >
                    <span
                      className={`w-1 h-1 rounded-full transition-all duration-200 ${
                        activeSection === id
                          ? "bg-purple-primary scale-150"
                          : "bg-muted/30 group-hover:bg-muted"
                      }`}
                    />
                    <span className="font-body">{label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 pb-32 lg:pl-12">
          <article className="max-w-[680px]">

            {/* Preamble */}
            <div className="mb-16 text-center lg:text-left">
              <p className="font-body text-lg text-ink/70 leading-relaxed italic">
                The PinkQuill Marketplace is where creativity meets commerce. These guidelines
                ensure a fair, trustworthy, and inspiring space for artists to sell their work
                and collectors to discover unique creations.
              </p>
            </div>

            {/* Mobile Table of Contents */}
            <nav className="lg:hidden mb-20 py-8 border-y border-black/[0.06]">
              <p className="font-ui text-[0.65rem] tracking-[0.2em] uppercase text-muted mb-6 text-center">
                Contents
              </p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 max-w-md mx-auto">
                {tocItems.map(({ id, label }, i) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    className="font-body text-sm text-muted hover:text-purple-primary transition-colors py-1 flex items-baseline gap-2"
                  >
                    <span className="text-[0.7rem] text-muted/50">{String(i + 1).padStart(2, "0")}</span>
                    {label}
                  </a>
                ))}
              </div>
            </nav>

            {/* Sections */}
            <div className="space-y-16">

              <Section id="introduction" number="01" title="Introduction">
                <p>
                  Welcome to the PinkQuill Marketplace—a curated space where artists, designers,
                  and creators can sell their original works directly to appreciative collectors
                  and fellow creatives.
                </p>
                <p>
                  Our marketplace is built on trust, authenticity, and respect for creative work.
                  Whether you're selling original paintings, limited edition prints, handcrafted
                  goods, or digital downloads, these guidelines help maintain the integrity and
                  quality our community deserves.
                </p>
                <p>
                  By listing products on the PinkQuill Marketplace, you agree to follow these
                  guidelines in addition to our{" "}
                  <Link href="/terms" className="text-purple-primary hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-purple-primary hover:underline">
                    Privacy Policy
                  </Link>.
                </p>
                <Highlight>
                  The PinkQuill Marketplace is for creative works and handmade goods. We are not
                  a general e-commerce platform—we celebrate artistry and craftsmanship.
                </Highlight>
              </Section>

              <Section id="seller-eligibility" number="02" title="Seller Eligibility">
                <p>
                  To sell on the PinkQuill Marketplace, you must meet the following requirements:
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Basic requirements
                </p>
                <ul>
                  <li>Be at least <strong>18 years old</strong> or the age of majority in your jurisdiction</li>
                  <li>Have a verified PinkQuill account in good standing</li>
                  <li>Provide accurate and complete seller information</li>
                  <li>Have the legal right to sell the products you list</li>
                  <li>Comply with all applicable laws and regulations in your region</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Account verification
                </p>
                <p>
                  Before you can start selling, we may require identity verification to protect
                  both buyers and sellers. This may include:
                </p>
                <ul>
                  <li>Government-issued ID verification</li>
                  <li>Address verification</li>
                  <li>Bank account or payment method verification</li>
                  <li>Tax information (where required by law)</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Business sellers
                </p>
                <p>
                  If you're selling as a business entity, you must provide valid business
                  registration information and ensure compliance with business regulations
                  in your jurisdiction.
                </p>
              </Section>

              <Section id="allowed-products" number="03" title="Allowed Products">
                <p>
                  The PinkQuill Marketplace is designed for creative and artistic products.
                  Here's what you can sell:
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Original artwork
                </p>
                <ul>
                  <li>Paintings (oil, acrylic, watercolor, mixed media)</li>
                  <li>Drawings and illustrations</li>
                  <li>Sculptures and 3D art</li>
                  <li>Photography (original prints)</li>
                  <li>Digital art and NFT-linked works</li>
                  <li>Collage and assemblage art</li>
                  <li>Textile and fiber art</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Reproductions & prints
                </p>
                <ul>
                  <li>Limited edition prints (clearly numbered and signed)</li>
                  <li>Open edition prints</li>
                  <li>Art prints on various materials (canvas, paper, metal, wood)</li>
                  <li>Posters and wall art</li>
                  <li>Photography prints</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Handmade & crafted goods
                </p>
                <ul>
                  <li>Handmade jewelry</li>
                  <li>Ceramics and pottery</li>
                  <li>Handcrafted home decor</li>
                  <li>Artisan clothing and accessories</li>
                  <li>Hand-bound books and journals</li>
                  <li>Calligraphy and lettering works</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Digital products
                </p>
                <ul>
                  <li>Digital art files (high-resolution downloads)</li>
                  <li>Design templates and assets</li>
                  <li>Fonts and typefaces (original creations)</li>
                  <li>Digital brushes and tools</li>
                  <li>Printable artwork and planners</li>
                  <li>Photography presets and filters</li>
                  <li>E-books and digital zines</li>
                  <li>Music and audio compositions (original works)</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Written works
                </p>
                <ul>
                  <li>Poetry chapbooks and collections</li>
                  <li>Self-published books</li>
                  <li>Zines and literary magazines</li>
                  <li>Commissioned written pieces</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Art supplies & tools
                </p>
                <ul>
                  <li>Handmade art supplies (paints, inks, papers)</li>
                  <li>Custom-made tools and equipment</li>
                  <li>Curated supply kits</li>
                </ul>
              </Section>

              <Section id="prohibited-items" number="04" title="Prohibited Items">
                <p>
                  The following items are <strong>strictly prohibited</strong> on the PinkQuill
                  Marketplace. Listings for these items will be removed, and sellers may face
                  account suspension or termination.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Illegal & regulated items
                </p>
                <ul>
                  <li>Illegal items or items that promote illegal activity</li>
                  <li>Weapons, ammunition, or explosive materials</li>
                  <li>Drugs, drug paraphernalia, or controlled substances</li>
                  <li>Tobacco products, e-cigarettes, or vaping products</li>
                  <li>Alcohol (unless you have proper licensing)</li>
                  <li>Prescription medications or medical devices</li>
                  <li>Items subject to embargoes or trade restrictions</li>
                  <li>Counterfeit currency or financial instruments</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Intellectual property violations
                </p>
                <ul>
                  <li>Counterfeit or knockoff products</li>
                  <li>Unauthorized reproductions of others' artwork</li>
                  <li>Items using copyrighted characters, logos, or imagery without permission</li>
                  <li>Fan art sold without proper licensing (where required)</li>
                  <li>Plagiarized or stolen designs</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Harmful content
                </p>
                <ul>
                  <li>Pornographic or sexually explicit material</li>
                  <li>Content that sexualizes minors in any way</li>
                  <li>Hate speech, discriminatory imagery, or symbols</li>
                  <li>Content promoting violence, terrorism, or self-harm</li>
                  <li>Defamatory content targeting individuals</li>
                  <li>Content that promotes dangerous activities</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Other prohibited items
                </p>
                <ul>
                  <li>Live animals or animal products from endangered species</li>
                  <li>Human remains or body parts</li>
                  <li>Recalled or unsafe products</li>
                  <li>Items that infringe on privacy rights</li>
                  <li>Stolen property or items with unclear provenance</li>
                  <li>Multi-level marketing or pyramid scheme products</li>
                  <li>Services (the marketplace is for physical and digital products only)</li>
                  <li>Mass-produced goods not created by the seller</li>
                  <li>Dropshipped items from third-party suppliers</li>
                </ul>

                <Highlight>
                  If you're unsure whether your product is allowed, contact us at{" "}
                  <a href="mailto:marketplace@pinkquill.com">marketplace@pinkquill.com</a>{" "}
                  before listing.
                </Highlight>
              </Section>

              <Section id="listing-products" number="05" title="Listing Products">
                <p>
                  Creating accurate, honest listings is essential for buyer trust and a healthy
                  marketplace. Follow these guidelines when listing your products:
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Listing requirements
                </p>
                <ul>
                  <li>Each listing must represent a single product or set (bundles clearly described)</li>
                  <li>List products in the most appropriate category</li>
                  <li>Use clear, accurate titles that describe the item</li>
                  <li>Provide complete and honest descriptions</li>
                  <li>Disclose all relevant information about condition, materials, and dimensions</li>
                  <li>State whether the item is an original, reproduction, or print</li>
                  <li>For limited editions, clearly state the edition size and number</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Product variations
                </p>
                <p>
                  If you offer a product in multiple variations (sizes, colors, materials),
                  you may include these in a single listing with clear options for buyers
                  to choose from. Each variation should be accurately described.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Stock & availability
                </p>
                <ul>
                  <li>Only list items you currently have in stock or can produce within stated timeframes</li>
                  <li>Update listings promptly when items sell out</li>
                  <li>For made-to-order items, clearly state production time</li>
                  <li>Don't create listings for items you don't intend to sell</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Duplicate listings
                </p>
                <p>
                  Each unique product should have only one active listing. Creating multiple
                  listings for the same item to gain more visibility is not allowed and may
                  result in listing removal.
                </p>
              </Section>

              <Section id="images-descriptions" number="06" title="Images & Descriptions">
                <p>
                  High-quality images and accurate descriptions help buyers make informed
                  decisions and reduce disputes.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Image requirements
                </p>
                <ul>
                  <li>Use your own photographs of the actual product</li>
                  <li>Include at least one clear, well-lit main image</li>
                  <li>Show the product from multiple angles when relevant</li>
                  <li>Include scale references or measurements in images when helpful</li>
                  <li>For prints/reproductions, show both the artwork and how it looks framed or displayed</li>
                  <li>Don't use heavily filtered or misleading images</li>
                  <li>Don't use stock photos or images from the internet</li>
                  <li>Don't include watermarks that obscure the product</li>
                  <li>Minimum resolution: 1000x1000 pixels for main image</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Description requirements
                </p>
                <ul>
                  <li>Write clear, detailed descriptions of your product</li>
                  <li>Include dimensions, materials, and weight where applicable</li>
                  <li>Describe the condition accurately (new, vintage, etc.)</li>
                  <li>Mention any flaws, imperfections, or wear</li>
                  <li>Explain your creative process or inspiration (buyers love this!)</li>
                  <li>Include care instructions when relevant</li>
                  <li>Don't include misleading claims or false information</li>
                  <li>Don't use excessive keywords or spam</li>
                  <li>Don't include external links or contact information for off-platform sales</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  For digital products
                </p>
                <ul>
                  <li>Clearly state file formats included</li>
                  <li>Specify resolution and dimensions</li>
                  <li>List what's included in the download</li>
                  <li>Explain any software requirements</li>
                  <li>Include preview images that represent the final product</li>
                </ul>
              </Section>

              <Section id="pricing-fees" number="07" title="Pricing & Fees">
                <p>
                  Set fair prices for your work and understand the fees involved in selling
                  on PinkQuill.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Setting prices
                </p>
                <ul>
                  <li>You have full control over your product prices</li>
                  <li>Prices must be listed in your selected currency</li>
                  <li>Include all applicable costs in the listed price (except shipping)</li>
                  <li>Don't inflate prices to deceive buyers about discounts</li>
                  <li>Prices should reflect the actual value of your work</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  PinkQuill fees
                </p>
                <p>
                  PinkQuill charges a <strong>5% transaction fee</strong> on each sale. This fee
                  is deducted from the sale price before payout. This low fee helps us maintain
                  the platform while ensuring creators keep more of their earnings.
                </p>
                <ul>
                  <li><strong>Transaction fee:</strong> 5% of the sale price</li>
                  <li><strong>Listing fee:</strong> Free (no cost to list products)</li>
                  <li><strong>Payment processing:</strong> Standard payment processor fees apply (typically 2.9% + $0.30)</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Example calculation
                </p>
                <p>
                  For a $100 sale:
                </p>
                <ul>
                  <li>Sale price: $100.00</li>
                  <li>PinkQuill fee (5%): -$5.00</li>
                  <li>Payment processing (~3%): -$3.30</li>
                  <li>Your payout: ~$91.70</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Sales and discounts
                </p>
                <p>
                  You may offer sales, discounts, or promotional pricing at your discretion.
                  All discounts must be genuine—don't inflate original prices to create
                  false discount impressions.
                </p>
              </Section>

              <Section id="physical-products" number="08" title="Physical Products">
                <p>
                  Shipping physical products requires careful attention to packaging,
                  timing, and communication.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Shipping policies
                </p>
                <ul>
                  <li>Clearly state shipping costs, methods, and estimated delivery times</li>
                  <li>Specify which regions/countries you ship to</li>
                  <li>Disclose any handling time before shipment</li>
                  <li>Provide tracking information when available</li>
                  <li>Ship items within the timeframe stated in your listing</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Packaging requirements
                </p>
                <ul>
                  <li>Package items securely to prevent damage during transit</li>
                  <li>Use appropriate materials for fragile items (artwork, ceramics, etc.)</li>
                  <li>Include padding, corner protectors, and rigid backing for prints</li>
                  <li>Consider sustainable packaging options when possible</li>
                  <li>Include a packing slip or thank-you note (personal touch appreciated!)</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Shipping timeframes
                </p>
                <p>
                  Unless your listing specifies otherwise (custom or made-to-order items),
                  you should ship items within:
                </p>
                <ul>
                  <li><strong>Ready-to-ship items:</strong> 3-5 business days</li>
                  <li><strong>Made-to-order items:</strong> As stated in listing (typically 1-4 weeks)</li>
                  <li><strong>Custom commissions:</strong> As agreed with buyer</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Lost or damaged shipments
                </p>
                <p>
                  We strongly recommend purchasing shipping insurance for valuable items.
                  You are responsible for items until they reach the buyer. If an item
                  is lost or damaged in transit, work with the buyer and carrier to resolve
                  the issue.
                </p>
              </Section>

              <Section id="digital-products" number="09" title="Digital Products">
                <p>
                  Digital products offer instant delivery and global reach. Here's how to
                  sell them effectively on PinkQuill.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Delivery requirements
                </p>
                <ul>
                  <li>Digital products should be delivered automatically after purchase</li>
                  <li>Provide download links that work reliably</li>
                  <li>Ensure files are properly formatted and free of corruption</li>
                  <li>Include any necessary instructions for accessing or using files</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  File specifications
                </p>
                <ul>
                  <li>Use standard, widely-compatible file formats</li>
                  <li>Compress large files appropriately without quality loss</li>
                  <li>Maximum file size: 5GB per product</li>
                  <li>Clearly list all file formats included</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Licensing
                </p>
                <p>
                  Clearly state the license terms for your digital products:
                </p>
                <ul>
                  <li><strong>Personal use only:</strong> Buyer can use for personal, non-commercial purposes</li>
                  <li><strong>Commercial license:</strong> Buyer can use in commercial projects</li>
                  <li><strong>Extended license:</strong> Additional rights (unlimited prints, resale in products, etc.)</li>
                </ul>
                <p>
                  Be specific about what buyers can and cannot do with your digital files.
                  Include license terms in your listing and consider providing a license
                  document with the download.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Refunds for digital products
                </p>
                <p>
                  Due to the nature of digital products, refunds are handled on a case-by-case
                  basis. Clearly state your refund policy in your listings. Generally, refunds
                  may be issued if:
                </p>
                <ul>
                  <li>Files are corrupted or won't download</li>
                  <li>Product significantly differs from the description</li>
                  <li>Technical issues prevent the buyer from accessing the product</li>
                </ul>
              </Section>

              <Section id="payments" number="10" title="Payments">
                <p>
                  Understanding how payments work helps you manage your seller finances
                  effectively.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Payment processing
                </p>
                <p>
                  All payments are processed through our secure payment system. We support
                  major credit cards, debit cards, and select digital wallets. Buyers pay
                  at checkout, and funds are held until order completion.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Payout schedule
                </p>
                <ul>
                  <li><strong>Digital products:</strong> Funds available 3 days after purchase</li>
                  <li><strong>Physical products:</strong> Funds available 3 days after delivery confirmation or 14 days after shipment (whichever comes first)</li>
                  <li><strong>Payout methods:</strong> Bank transfer, PayPal, or other supported methods</li>
                  <li><strong>Minimum payout:</strong> $10 USD (or equivalent)</li>
                  <li><strong>Payout frequency:</strong> Weekly or monthly (your choice)</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Currency
                </p>
                <p>
                  You can list products in your preferred currency. Buyers will see prices
                  converted to their local currency at checkout. Payouts are made in your
                  selected payout currency.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Payment holds
                </p>
                <p>
                  In certain situations, payments may be held for longer periods:
                </p>
                <ul>
                  <li>New sellers (first 30 days or first 10 sales)</li>
                  <li>Disputed transactions under review</li>
                  <li>High-value orders (additional verification may be required)</li>
                  <li>Account under review for policy compliance</li>
                </ul>
              </Section>

              <Section id="taxes-compliance" number="11" title="Taxes & Compliance">
                <p>
                  As a seller, you're responsible for understanding and complying with
                  tax obligations in your jurisdiction.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Your tax responsibilities
                </p>
                <ul>
                  <li>Report and pay income taxes on your earnings</li>
                  <li>Collect and remit sales tax where required</li>
                  <li>Maintain accurate records of all transactions</li>
                  <li>Consult with a tax professional for guidance specific to your situation</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Sales tax
                </p>
                <p>
                  Tax requirements vary by location. In some jurisdictions, PinkQuill may
                  collect and remit sales tax on your behalf (marketplace facilitator laws).
                  In others, you may be responsible for collecting and remitting taxes yourself.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Tax forms (US sellers)
                </p>
                <p>
                  If you're a US-based seller and meet IRS thresholds, you'll receive a
                  1099-K form for your tax records. Ensure your tax information on file
                  is accurate and up to date.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  VAT/GST (International sellers)
                </p>
                <p>
                  Sellers in regions with VAT, GST, or similar taxes should ensure compliance
                  with local regulations. Include necessary tax registration numbers in your
                  seller profile where required.
                </p>

                <Highlight>
                  PinkQuill does not provide tax advice. Consult a qualified tax professional
                  for guidance on your specific tax obligations.
                </Highlight>
              </Section>

              <Section id="buyer-protection" number="12" title="Buyer Protection">
                <p>
                  We want every purchase on PinkQuill to be a positive experience. Our
                  buyer protection ensures confidence when shopping.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  What's covered
                </p>
                <ul>
                  <li>Items that don't match the listing description</li>
                  <li>Items that arrive damaged due to inadequate packaging</li>
                  <li>Items that never arrive (lost in transit)</li>
                  <li>Unauthorized transactions on the buyer's account</li>
                  <li>Digital products that can't be accessed or downloaded</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  What's not covered
                </p>
                <ul>
                  <li>Buyer's remorse or change of mind</li>
                  <li>Items accurately described that buyer simply doesn't like</li>
                  <li>Damage caused by buyer after delivery</li>
                  <li>Issues arising from buyer providing incorrect shipping information</li>
                  <li>Custom orders made to buyer specifications</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Filing a claim
                </p>
                <p>
                  If a buyer has an issue with an order, they should first contact the
                  seller to resolve it. If resolution isn't possible, buyers can file
                  a claim within 30 days of delivery (or expected delivery date).
                </p>
              </Section>

              <Section id="seller-protection" number="13" title="Seller Protection">
                <p>
                  We also protect sellers from fraudulent buyers and unfair disputes.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  What's covered
                </p>
                <ul>
                  <li>Fraudulent chargebacks with proof of delivery</li>
                  <li>False claims of non-receipt when tracking shows delivery</li>
                  <li>Buyer abuse or harassment</li>
                  <li>Buyers who refuse delivery or provide false information</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Protecting yourself
                </p>
                <ul>
                  <li>Always use tracked shipping for physical products</li>
                  <li>Keep records of all communication with buyers</li>
                  <li>Document items before shipping (photos of packaging)</li>
                  <li>Ship to the address provided through PinkQuill only</li>
                  <li>Don't conduct transactions outside the platform</li>
                  <li>Respond to buyer inquiries promptly and professionally</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Chargeback protection
                </p>
                <p>
                  If a buyer files a chargeback with their bank, we'll represent you in
                  the dispute if you have valid tracking showing delivery. Provide all
                  requested documentation promptly to support your case.
                </p>
              </Section>

              <Section id="disputes-refunds" number="14" title="Disputes & Refunds">
                <p>
                  We encourage buyers and sellers to resolve issues directly. When that's
                  not possible, we're here to help.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Resolution process
                </p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li><strong>Direct communication:</strong> Buyer contacts seller through PinkQuill messages</li>
                  <li><strong>Good faith resolution:</strong> Seller responds within 3 business days and works toward resolution</li>
                  <li><strong>Escalation:</strong> If unresolved after 7 days, either party can escalate to PinkQuill</li>
                  <li><strong>Review:</strong> We review evidence from both parties and make a decision</li>
                  <li><strong>Resolution:</strong> Refund issued or case closed based on findings</li>
                </ol>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Refund policies
                </p>
                <p>
                  Sellers should establish clear refund policies in their shop settings.
                  While you have flexibility in setting policies, consider:
                </p>
                <ul>
                  <li>Accepting returns for items significantly not as described</li>
                  <li>Offering exchanges where possible</li>
                  <li>Being reasonable with custom or personalized items</li>
                  <li>Communicating policies clearly before purchase</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Cancellations
                </p>
                <ul>
                  <li><strong>Buyer cancellation:</strong> Requests must be made before shipment; seller has discretion</li>
                  <li><strong>Seller cancellation:</strong> Avoid when possible; repeated cancellations affect account standing</li>
                  <li><strong>Full refunds:</strong> Issued for cancelled orders; fees returned to seller</li>
                </ul>
              </Section>

              <Section id="reviews-ratings" number="15" title="Reviews & Ratings">
                <p>
                  Reviews help build trust and help buyers make informed decisions.
                  They should be honest and constructive.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Leaving reviews
                </p>
                <ul>
                  <li>Buyers can leave reviews after receiving their order</li>
                  <li>Reviews should be honest and based on the actual transaction</li>
                  <li>Include helpful details about product quality, accuracy, shipping, and communication</li>
                  <li>Photos in reviews are encouraged</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Review guidelines
                </p>
                <p>
                  Reviews must not contain:
                </p>
                <ul>
                  <li>False or misleading information</li>
                  <li>Personal attacks or harassment</li>
                  <li>Irrelevant content unrelated to the transaction</li>
                  <li>Spam or promotional content</li>
                  <li>Private information about the seller</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Responding to reviews
                </p>
                <p>
                  Sellers can respond to reviews publicly. Keep responses professional
                  and constructive, even for negative reviews. A thoughtful response
                  to criticism can demonstrate your commitment to customer satisfaction.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Prohibited practices
                </p>
                <ul>
                  <li>Offering incentives for positive reviews</li>
                  <li>Threatening or harassing buyers over reviews</li>
                  <li>Creating fake reviews (for yourself or others)</li>
                  <li>Asking buyers to change or remove reviews in exchange for refunds</li>
                </ul>
              </Section>

              <Section id="intellectual-property" number="16" title="Intellectual Property">
                <p>
                  Respecting intellectual property rights is fundamental to a creative
                  marketplace.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Your rights
                </p>
                <p>
                  You retain full ownership of your original creative works. Listing on
                  PinkQuill grants us a limited license to display and promote your products
                  on the platform—nothing more. We will never claim ownership of your art.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Respecting others' rights
                </p>
                <ul>
                  <li>Only sell work you created or have rights to sell</li>
                  <li>Don't copy or reproduce others' artwork without permission</li>
                  <li>Understand fair use limitations—commercial sale often doesn't qualify</li>
                  <li>Get proper licenses for fan art featuring copyrighted characters</li>
                  <li>Credit collaborators and contributors appropriately</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Copyright claims (DMCA)
                </p>
                <p>
                  If your work has been infringed on PinkQuill, submit a DMCA takedown
                  notice to{" "}
                  <a href="mailto:dmca@pinkquill.com" className="text-purple-primary hover:underline">
                    dmca@pinkquill.com
                  </a>{" "}
                  including:
                </p>
                <ul>
                  <li>Identification of the copyrighted work</li>
                  <li>Location of the infringing content on PinkQuill</li>
                  <li>Your contact information</li>
                  <li>A good-faith statement of infringement</li>
                  <li>A statement of accuracy under penalty of perjury</li>
                  <li>Your physical or electronic signature</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Counter-notices
                </p>
                <p>
                  If you believe your content was wrongly removed, you may submit a
                  counter-notice. We'll reinstate the content after 10-14 business days
                  unless the claimant files legal action.
                </p>
              </Section>

              <Section id="account-standing" number="17" title="Account Standing">
                <p>
                  Maintaining good account standing ensures continued access to the marketplace
                  and builds buyer trust.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Factors affecting standing
                </p>
                <ul>
                  <li><strong>Order completion rate:</strong> Successfully fulfilled orders</li>
                  <li><strong>Shipping performance:</strong> On-time shipments with tracking</li>
                  <li><strong>Customer reviews:</strong> Overall rating and feedback</li>
                  <li><strong>Response time:</strong> How quickly you respond to inquiries</li>
                  <li><strong>Policy compliance:</strong> Following marketplace guidelines</li>
                  <li><strong>Dispute rate:</strong> Frequency of escalated issues</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Maintaining good standing
                </p>
                <ul>
                  <li>Ship orders on time or communicate delays promptly</li>
                  <li>Respond to messages within 24-48 hours</li>
                  <li>Resolve issues directly with buyers when possible</li>
                  <li>Keep listings accurate and up to date</li>
                  <li>Follow all marketplace guidelines</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Standing levels
                </p>
                <ul>
                  <li><strong>Good standing:</strong> Full marketplace privileges</li>
                  <li><strong>Warning:</strong> Minor issues identified; improvement needed</li>
                  <li><strong>Restricted:</strong> Limited features; active improvement plan required</li>
                  <li><strong>Suspended:</strong> Selling privileges temporarily removed</li>
                </ul>
              </Section>

              <Section id="violations" number="18" title="Violations & Enforcement">
                <p>
                  We take violations seriously to maintain a safe, trustworthy marketplace
                  for everyone.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Types of violations
                </p>
                <ul>
                  <li><strong>Minor:</strong> Listing errors, late shipping, slow response times</li>
                  <li><strong>Moderate:</strong> Inaccurate descriptions, policy violations, multiple minor issues</li>
                  <li><strong>Severe:</strong> Prohibited items, IP infringement, fraud, harassment</li>
                  <li><strong>Critical:</strong> Illegal activity, safety concerns, identity fraud</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Enforcement actions
                </p>
                <ul>
                  <li><strong>Warning:</strong> Notice of violation with required corrective action</li>
                  <li><strong>Listing removal:</strong> Violating listings removed without refund of fees</li>
                  <li><strong>Feature restrictions:</strong> Limited access to certain marketplace features</li>
                  <li><strong>Temporary suspension:</strong> Selling privileges paused for review period</li>
                  <li><strong>Permanent termination:</strong> Account permanently banned from marketplace</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Appeals
                </p>
                <p>
                  If you believe an enforcement action was taken in error, you may appeal
                  within 30 days by contacting{" "}
                  <a href="mailto:appeals@pinkquill.com" className="text-purple-primary hover:underline">
                    appeals@pinkquill.com
                  </a>.
                  Include your account details and a clear explanation of why you believe
                  the decision should be reconsidered.
                </p>

                <Highlight>
                  Severe or repeated violations may result in immediate termination without
                  warning. We reserve the right to withhold payouts for unresolved violations.
                </Highlight>
              </Section>

              <Section id="changes" number="19" title="Changes to Guidelines">
                <p>
                  We may update these guidelines to reflect changes in our marketplace,
                  legal requirements, or community needs.
                </p>
                <ul>
                  <li>Material changes will be announced at least 30 days in advance</li>
                  <li>Updates posted on this page with the revision date</li>
                  <li>Email notification sent to active sellers for significant changes</li>
                  <li>Continued use of the marketplace constitutes acceptance of updated guidelines</li>
                </ul>
                <p>
                  We encourage you to review these guidelines periodically. If you disagree
                  with changes, you may close your seller account before the changes take effect.
                </p>
              </Section>

              <Section id="contact" number="20" title="Contact & Support">
                <p>
                  We're here to help you succeed on the PinkQuill Marketplace. Reach out
                  with questions, concerns, or feedback.
                </p>
                <div className="mt-6 space-y-2">
                  <p>
                    <span className="text-muted">General marketplace inquiries —</span>{" "}
                    <a href="mailto:marketplace@pinkquill.com" className="text-purple-primary hover:underline">
                      marketplace@pinkquill.com
                    </a>
                  </p>
                  <p>
                    <span className="text-muted">Seller support —</span>{" "}
                    <a href="mailto:sellers@pinkquill.com" className="text-purple-primary hover:underline">
                      sellers@pinkquill.com
                    </a>
                  </p>
                  <p>
                    <span className="text-muted">Buyer support —</span>{" "}
                    <a href="mailto:support@pinkquill.com" className="text-purple-primary hover:underline">
                      support@pinkquill.com
                    </a>
                  </p>
                  <p>
                    <span className="text-muted">Copyright & DMCA —</span>{" "}
                    <a href="mailto:dmca@pinkquill.com" className="text-purple-primary hover:underline">
                      dmca@pinkquill.com
                    </a>
                  </p>
                  <p>
                    <span className="text-muted">Appeals —</span>{" "}
                    <a href="mailto:appeals@pinkquill.com" className="text-purple-primary hover:underline">
                      appeals@pinkquill.com
                    </a>
                  </p>
                  <p>
                    <span className="text-muted">Report violations —</span>{" "}
                    <a href="mailto:report@pinkquill.com" className="text-purple-primary hover:underline">
                      report@pinkquill.com
                    </a>
                  </p>
                </div>
                <p className="mt-6">
                  For urgent issues or questions about active orders, use the in-app
                  support chat for fastest response times.
                </p>
              </Section>

            </div>

            {/* Closing */}
            <div className="mt-24 pt-16 border-t border-black/[0.06] text-center lg:text-left">
              <div className="flex items-center justify-center lg:justify-start gap-3 mb-8">
                <span className="w-8 h-px bg-gradient-to-r from-transparent to-purple-primary/30" />
                <FontAwesomeIcon icon={faFeatherPointed} className="w-5 h-5 text-purple-primary/50" />
                <span className="w-8 h-px bg-gradient-to-l from-transparent to-purple-primary/30" />
              </div>
              <p className="font-body text-muted italic mb-8">
                Thank you for being part of our creative marketplace community.
              </p>
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 font-ui text-sm text-purple-primary hover:text-pink-vivid transition-colors"
              >
                <FontAwesomeIcon icon={faFeatherPointed} className="w-3.5 h-3.5" />
                Explore the Marketplace
              </Link>
            </div>

          </article>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-black/[0.06] py-8 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <p className="font-ui text-xs text-muted/60">
            © {new Date().getFullYear()} PinkQuill
          </p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="font-ui text-xs text-muted/60 hover:text-purple-primary transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="font-ui text-xs text-muted/60 hover:text-purple-primary transition-colors">
              Terms
            </Link>
            <Link href="/marketplace-guidelines" className="font-ui text-xs text-purple-primary">
              Marketplace
            </Link>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        .marketplace-section p {
          font-family: var(--font-body);
          font-size: 1.05rem;
          line-height: 1.85;
          color: #3d3d3d;
          margin-bottom: 1.25rem;
        }

        .marketplace-section p:last-child {
          margin-bottom: 0;
        }

        .marketplace-section strong {
          font-weight: 600;
          color: var(--ink);
        }

        .marketplace-section ul,
        .marketplace-section ol {
          margin: 1rem 0 1.25rem 0;
          padding: 0;
          list-style: none;
        }

        .marketplace-section li {
          font-family: var(--font-body);
          font-size: 1rem;
          line-height: 1.75;
          color: #3d3d3d;
          padding-left: 1.5rem;
          margin-bottom: 0.5rem;
          position: relative;
        }

        .marketplace-section ul li::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0.7rem;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary-purple), var(--vivid-pink));
        }

        .marketplace-section ol {
          counter-reset: list-counter;
        }

        .marketplace-section ol li {
          counter-increment: list-counter;
        }

        .marketplace-section ol li::before {
          content: counter(list-counter) ".";
          position: absolute;
          left: 0;
          font-weight: 600;
          color: var(--primary-purple);
        }

        .marketplace-section a {
          color: var(--primary-purple);
          text-decoration: none;
          transition: color 0.2s;
        }

        .marketplace-section a:hover {
          color: var(--vivid-pink);
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}

function Section({
  id,
  number,
  title,
  children
}: {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="marketplace-section scroll-mt-24">
      <header className="mb-6">
        <span className="font-ui text-[0.65rem] tracking-[0.2em] text-purple-primary/60 block mb-2">
          {number}
        </span>
        <h2 className="font-display text-2xl font-normal text-ink">
          {title}
        </h2>
      </header>
      <div>{children}</div>
    </section>
  );
}

function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 pl-5 border-l-2 border-purple-primary/30">
      <p className="font-body text-[0.95rem] text-muted italic !mb-0">
        {children}
      </p>
    </div>
  );
}
