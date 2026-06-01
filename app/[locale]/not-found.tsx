import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/container";

export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <Container>
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: "var(--s-4)",
          paddingBlock: "var(--s-24)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-micro)",
            letterSpacing: "var(--tracking-eyebrow)",
            textTransform: "uppercase",
            color: "var(--color-brand-deep)",
          }}
        >
          404
        </p>
        <h1
          style={{
            fontSize: "var(--fs-h1)",
            color: "var(--color-text-strong)",
          }}
        >
          {t("title")}
        </h1>
        <p
          style={{
            fontSize: "var(--fs-body-lg)",
            color: "var(--color-text-muted)",
            maxWidth: "42ch",
          }}
        >
          {t("description")}
        </p>
        <Link
          href="/"
          style={{
            marginTop: "var(--s-2)",
            display: "inline-flex",
            alignItems: "center",
            height: 44,
            padding: "0 18px",
            borderRadius: "var(--r-pill)",
            background: "var(--color-brand)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 500,
            boxShadow: "var(--shadow-brand)",
          }}
        >
          {t("backHome")}
        </Link>
      </div>
    </Container>
  );
}
