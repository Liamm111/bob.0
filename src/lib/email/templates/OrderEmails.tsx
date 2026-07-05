import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Row,
  Column,
  Button,
  Hr,
} from "@react-email/components";

export type EmailBrand = {
  cafeName: string;
  primary: string;
  accent: string;
  logoText: string;
};

export type EmailOrder = {
  orderNumber: string;
  pickupLabel: string;
  currency: string;
  totalLabel: string;
  items: { name: string; qty: number }[];
  vatBreakdown: { rate: string; amountLabel: string }[];
  trackUrl: string;
};

const font = {
  fontFamily:
    "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
};

function Shell({
  brand,
  preview,
  children,
}: {
  brand: EmailBrand;
  preview: string;
  children: React.ReactNode;
}) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ ...font, backgroundColor: "#f4f1ec", margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 520, margin: "0 auto", padding: "24px 0" }}>
          <Section
            style={{
              backgroundColor: brand.primary,
              borderRadius: "14px 14px 0 0",
              padding: "20px 24px",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: 700, fontSize: 20, margin: 0 }}>
              {brand.logoText || brand.cafeName}
            </Text>
          </Section>
          <Section
            style={{
              backgroundColor: "#fff",
              padding: "24px",
              borderRadius: "0 0 14px 14px",
            }}
          >
            {children}
          </Section>
          <Text style={{ ...font, color: "#8a8a8a", fontSize: 12, textAlign: "center", marginTop: 16 }}>
            {brand.cafeName} — Click &amp; Collect. Vos données servent uniquement
            au traitement de votre commande et à votre fidélité (nLPD).
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

function OrderLines({ order }: { order: EmailOrder }) {
  return (
    <Section>
      {order.items.map((it, i) => (
        <Row key={i} style={{ marginBottom: 4 }}>
          <Column>
            <Text style={{ ...font, margin: 0 }}>
              {it.qty} × {it.name}
            </Text>
          </Column>
        </Row>
      ))}
      <Hr style={{ borderColor: "#eee" }} />
      {order.vatBreakdown.map((v) => (
        <Row key={v.rate}>
          <Column>
            <Text style={{ ...font, color: "#8a8a8a", fontSize: 12, margin: 0 }}>
              dont TVA {v.rate}% : {order.currency} {v.amountLabel}
            </Text>
          </Column>
        </Row>
      ))}
      <Row style={{ marginTop: 6 }}>
        <Column>
          <Text style={{ ...font, fontWeight: 700, margin: 0 }}>
            Total : {order.currency} {order.totalLabel}
          </Text>
        </Column>
      </Row>
    </Section>
  );
}

export function OrderConfirmationEmail({
  brand,
  order,
}: {
  brand: EmailBrand;
  order: EmailOrder;
}) {
  return (
    <Shell brand={brand} preview={`Commande ${order.orderNumber} confirmée`}>
      <Heading style={{ ...font, fontSize: 22, marginTop: 0 }}>
        Merci ! Commande confirmée
      </Heading>
      <Text style={font}>
        Votre commande <strong>{order.orderNumber}</strong> est confirmée.
      </Text>
      <Text style={{ ...font, fontSize: 16 }}>
        Retrait : <strong>{order.pickupLabel}</strong>
      </Text>
      <OrderLines order={order} />
      <Button
        href={order.trackUrl}
        style={{
          backgroundColor: brand.accent,
          color: "#1c1c1c",
          padding: "12px 18px",
          borderRadius: 10,
          fontWeight: 700,
          textDecoration: "none",
          display: "inline-block",
          marginTop: 16,
        }}
      >
        Suivre ma commande
      </Button>
    </Shell>
  );
}

export function OrderReadyEmail({
  brand,
  order,
}: {
  brand: EmailBrand;
  order: EmailOrder;
}) {
  return (
    <Shell brand={brand} preview={`Commande ${order.orderNumber} prête`}>
      <Heading style={{ ...font, fontSize: 22, marginTop: 0 }}>
        C'est prêt !
      </Heading>
      <Text style={font}>
        Votre commande <strong>{order.orderNumber}</strong> vous attend au
        comptoir. Présentez votre pass fidélité si vous en avez un !
      </Text>
      <OrderLines order={order} />
    </Shell>
  );
}

export function OrderCancelledEmail({
  brand,
  order,
  refunded,
}: {
  brand: EmailBrand;
  order: EmailOrder;
  refunded: boolean;
}) {
  return (
    <Shell brand={brand} preview={`Commande ${order.orderNumber} annulée`}>
      <Heading style={{ ...font, fontSize: 22, marginTop: 0 }}>
        Commande annulée
      </Heading>
      <Text style={font}>
        Votre commande <strong>{order.orderNumber}</strong> a été annulée.
        {refunded
          ? " Le remboursement a été initié et apparaîtra sous quelques jours."
          : ""}
      </Text>
      <OrderLines order={order} />
    </Shell>
  );
}
