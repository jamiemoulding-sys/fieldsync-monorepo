import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { reportAPI } from "../../services/api";

const coalesce = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const getPayPeriod = (payslip) =>
  coalesce(
    payslip.period,
    payslip.pay_period,
    payslip.month,
    payslip.period_label,
    payslip.file_name,
    "Payslip"
  );

const getGrossPay = (payslip) =>
  coalesce(payslip.gross_pay, payslip.gross, payslip.total_gross, payslip.grossPay);

const getNetPay = (payslip) =>
  coalesce(payslip.net_pay, payslip.net, payslip.total_net, payslip.netPay);

const getHours = (payslip) =>
  coalesce(payslip.hours, payslip.total_hours, payslip.paid_hours, payslip.hours_worked);

const getDateSent = (payslip) =>
  coalesce(payslip.sent_at, payslip.date_sent, payslip.published_at, payslip.created_at);

const getSecureUrl = (payslip) =>
  coalesce(
    payslip.signed_url,
    payslip.secure_url,
    payslip.view_url,
    payslip.download_url
  );

const getFilePath = (payslip) => coalesce(payslip.file_path, payslip.storage_path);

const formatMoney = (value) => {
  const amount = Number(value);
  if (Number.isNaN(amount)) return "--";
  return `£${amount.toFixed(2)}`;
};

const formatHours = (value) => {
  const amount = Number(value);
  if (Number.isNaN(amount)) return "--";
  return `${amount.toFixed(amount % 1 ? 1 : 0)}h`;
};

const formatDate = (value) => {
  if (!value) return "Not sent";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const normalizePayslips = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.payslips)) return payload.payslips;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const sortPayslips = (items) =>
  [...items].sort((a, b) => {
    const aDate = new Date(getDateSent(a) || a.period_end || a.end_date || 0).getTime();
    const bDate = new Date(getDateSent(b) || b.period_end || b.end_date || 0).getTime();
    return (Number.isNaN(bDate) ? 0 : bDate) - (Number.isNaN(aDate) ? 0 : aDate);
  });

export default function Payslips() {
  const [payslips, setPayslips] = useState([]);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [setupMissing, setSetupMissing] = useState(false);

  const sheetAnim = useRef(new Animated.Value(0)).current;

  const loadPayslips = useCallback(async ({ refreshing: isRefreshing = false } = {}) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      setSetupMissing(false);

      const data = await reportAPI.getPayslips();
      setPayslips(sortPayslips(normalizePayslips(data)));
    } catch (loadError) {
      const status = loadError.response?.status;
      setPayslips([]);

      if (status === 404 || status === 403) {
        setSetupMissing(status === 404);
        setError(
          status === 404
            ? "Payslip service is not configured yet."
            : "You do not have access to payslips for this account."
        );
      } else {
        setError(loadError.message || "Payslips could not be loaded.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPayslips();
  }, [loadPayslips]);

  const latestPayslip = payslips[0] || null;

  const summary = useMemo(() => {
    const availableCount = payslips.length;
    const downloadedCount = payslips.filter((payslip) => payslip.downloaded_at).length;

    return {
      availableCount,
      downloadedCount,
      latestNet: latestPayslip ? formatMoney(getNetPay(latestPayslip)) : "--",
    };
  }, [latestPayslip, payslips]);

  const openPayslip = (payslip) => {
    setSelectedPayslip(payslip);
    sheetAnim.setValue(0);

    Animated.timing(sheetAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  };

  const closePayslip = () => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setSelectedPayslip(null));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingWrap}>
          <View style={styles.loadingIcon}>
            <ActivityIndicator color="#ffffff" size="large" />
          </View>
          <Text style={styles.loadingTitle}>Loading payslips</Text>
          <Text style={styles.loadingText}>Checking secure payroll records...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadPayslips({ refreshing: true })}
            tintColor="#6366f1"
            colors={["#6366f1"]}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Payroll documents</Text>
            <Text style={styles.title}>Payslips</Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={() => loadPayslips()}>
            <Ionicons name="refresh-outline" size={22} color="#c7d2fe" />
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <View style={styles.errorIcon}>
              <Ionicons name="alert-circle-outline" size={28} color="#fecaca" />
            </View>
            <View style={styles.errorBody}>
              <Text style={styles.errorTitle}>
                {setupMissing ? "Backend setup needed" : "Payslips unavailable"}
              </Text>
              <Text style={styles.errorText}>{error}</Text>
              {setupMissing ? (
                <Text style={styles.setupText}>
                  Add a server-side payslips table with secure Supabase Storage file
                  paths and an employee-scoped API that returns signed view/download URLs.
                </Text>
              ) : null}
              <TouchableOpacity style={styles.retryButton} onPress={() => loadPayslips()}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryIcon}>
              <Ionicons name="shield-checkmark-outline" size={24} color="#a5b4fc" />
            </View>
            <View style={styles.summaryBody}>
              <Text style={styles.summaryTitle}>Secure official copies</Text>
              <Text style={styles.summaryText}>
                Payslips stay server-side. Local download is optional.
              </Text>
            </View>
          </View>
          <View style={styles.metricGrid}>
            <SummaryMetric label="Available" value={String(summary.availableCount)} />
            <SummaryMetric label="Downloaded" value={String(summary.downloadedCount)} />
            <SummaryMetric label="Latest net" value={summary.latestNet} accent />
          </View>
        </View>

        {payslips.length === 0 ? (
          <EmptyState setupMissing={setupMissing} />
        ) : (
          payslips.map((payslip, index) => (
            <PayslipCard
              key={payslip.id || `${getPayPeriod(payslip)}-${index}`}
              payslip={payslip}
              onPress={() => openPayslip(payslip)}
            />
          ))
        )}
      </ScrollView>

      <PayslipSheet
        payslip={selectedPayslip}
        sheetAnim={sheetAnim}
        onClose={closePayslip}
      />
    </SafeAreaView>
  );
}

function SummaryMetric({ label, value, accent = false }) {
  return (
    <View style={[styles.metricCard, accent && styles.metricCardAccent]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, accent && styles.metricValueAccent]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function PayslipCard({ payslip, onPress }) {
  const hasSecureUrl = !!getSecureUrl(payslip);
  const statusText = payslip.downloaded_at ? "Downloaded" : "Available";

  return (
    <TouchableOpacity style={styles.payslipCard} onPress={onPress} activeOpacity={0.82}>
      <View style={styles.cardTop}>
        <View style={styles.documentIcon}>
          <Ionicons name="document-text-outline" size={23} color="#a5b4fc" />
        </View>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.periodTitle} numberOfLines={1}>
            {getPayPeriod(payslip)}
          </Text>
          <Text style={styles.sentText}>Sent {formatDate(getDateSent(payslip))}</Text>
        </View>
        <View style={[styles.statusBadge, payslip.downloaded_at && styles.statusBadgeDone]}>
          <Text
            style={[
              styles.statusText,
              payslip.downloaded_at && styles.statusTextDone,
            ]}
            numberOfLines={1}
          >
            {statusText}
          </Text>
        </View>
      </View>

      <View style={styles.payGrid}>
        <PayItem label="Gross" value={formatMoney(getGrossPay(payslip))} />
        <PayItem label="Net" value={formatMoney(getNetPay(payslip))} accent />
        <PayItem label="Hours" value={formatHours(getHours(payslip))} />
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.securityRow}>
          <Ionicons
            name={hasSecureUrl ? "lock-closed-outline" : "cloud-offline-outline"}
            size={15}
            color={hasSecureUrl ? "#86efac" : "#fbbf24"}
          />
          <Text style={styles.securityText}>
            {hasSecureUrl ? "Secure PDF link ready" : "Secure PDF link unavailable"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#64748b" />
      </View>
    </TouchableOpacity>
  );
}

function PayItem({ label, value, accent = false }) {
  return (
    <View style={[styles.payItem, accent && styles.payItemAccent]}>
      <Text style={styles.payLabel}>{label}</Text>
      <Text style={[styles.payValue, accent && styles.payValueAccent]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function EmptyState({ setupMissing }) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name="document-lock-outline" size={44} color="#64748b" />
      <Text style={styles.emptyTitle}>
        {setupMissing ? "Payslips are not wired up yet" : "No payslips available"}
      </Text>
      <Text style={styles.emptyText}>
        {setupMissing
          ? "The mobile app is ready for server-side payslips once the backend endpoint and payslips table are added."
          : "Published payslips will appear here once payroll uploads them."}
      </Text>
    </View>
  );
}

function PayslipSheet({ payslip, sheetAnim, onClose }) {
  const translateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [500, 0],
  });

  if (!payslip) return null;

  const secureUrl = getSecureUrl(payslip);
  const filePath = getFilePath(payslip);

  const openSecureUrl = async () => {
    if (!secureUrl) return;
    await Linking.openURL(secureUrl);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalBackdrop} onPress={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleWrap}>
              <Text style={styles.sheetTitle}>{getPayPeriod(payslip)}</Text>
              <Text style={styles.sheetSubtitle}>Official copy stored securely server-side</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <DetailRow icon="calendar-outline" label="Date sent" value={formatDate(getDateSent(payslip))} />
          <DetailRow icon="cash-outline" label="Gross pay" value={formatMoney(getGrossPay(payslip))} />
          <DetailRow icon="wallet-outline" label="Net pay" value={formatMoney(getNetPay(payslip))} highlight />
          <DetailRow icon="time-outline" label="Hours" value={formatHours(getHours(payslip))} />
          <DetailRow
            icon="folder-outline"
            label="Storage path"
            value={filePath ? "Stored securely" : "Not provided"}
          />

          {!secureUrl ? (
            <View style={styles.missingLinkBox}>
              <Ionicons name="lock-closed-outline" size={20} color="#fbbf24" />
              <Text style={styles.missingLinkText}>
                This payslip needs a backend-generated signed URL before it can be
                viewed or downloaded.
              </Text>
            </View>
          ) : null}

          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={[styles.sheetButton, !secureUrl && styles.sheetButtonDisabled]}
              onPress={openSecureUrl}
              disabled={!secureUrl}
            >
              <Ionicons name="eye-outline" size={19} color="#ffffff" />
              <Text style={styles.sheetButtonText}>View PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetButtonSecondary, !secureUrl && styles.sheetButtonDisabled]}
              onPress={openSecureUrl}
              disabled={!secureUrl}
            >
              <Ionicons name="download-outline" size={19} color="#c7d2fe" />
              <Text style={styles.sheetButtonSecondaryText}>Save Locally</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function DetailRow({ icon, label, value, highlight = false }) {
  return (
    <View style={[styles.detailRow, highlight && styles.detailRowHighlight]}>
      <View style={[styles.detailIcon, highlight && styles.detailIconHighlight]}>
        <Ionicons name={icon} size={18} color="#a5b4fc" />
      </View>
      <View style={styles.detailBody}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={[styles.detailValue, highlight && styles.detailValueHighlight]} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#020617",
  },

  scroll: {
    flex: 1,
    backgroundColor: "#020617",
  },

  content: {
    flexGrow: 1,
    backgroundColor: "#020617",
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 36,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#020617",
  },

  loadingIcon: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366f1",
    marginBottom: 20,
  },

  loadingTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
  },

  loadingText: {
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  eyebrow: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
  },

  title: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
    marginTop: 2,
  },

  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
  },

  errorCard: {
    flexDirection: "row",
    backgroundColor: "#3f1018",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#7f1d1d",
    padding: 16,
    marginBottom: 16,
  },

  errorIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7f1d1d",
    marginRight: 12,
  },

  errorBody: {
    flex: 1,
    minWidth: 0,
  },

  errorTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  errorText: {
    color: "#fecaca",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },

  setupText: {
    color: "#fed7aa",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 9,
  },

  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#dc2626",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
  },

  retryText: {
    color: "#ffffff",
    fontWeight: "800",
  },

  summaryCard: {
    backgroundColor: "#0f172a",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 16,
    marginBottom: 16,
  },

  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },

  summaryIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e1b4b",
    borderWidth: 1,
    borderColor: "#3730a3",
    marginRight: 13,
  },

  summaryBody: {
    flex: 1,
    minWidth: 0,
  },

  summaryTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  summaryText: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },

  metricGrid: {
    flexDirection: "row",
    gap: 10,
  },

  metricCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#273449",
    padding: 12,
  },

  metricCardAccent: {
    backgroundColor: "#15173a",
    borderColor: "#3730a3",
  },

  metricLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  metricValue: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 5,
  },

  metricValueAccent: {
    color: "#c7d2fe",
  },

  payslipCard: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 16,
    marginBottom: 12,
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  documentIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#273449",
    marginRight: 12,
  },

  cardTitleWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },

  periodTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
  },

  sentText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },

  statusBadge: {
    maxWidth: 116,
    backgroundColor: "#1e1b4b",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3730a3",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  statusBadgeDone: {
    backgroundColor: "#052e16",
    borderColor: "#166534",
  },

  statusText: {
    color: "#c7d2fe",
    fontSize: 11,
    fontWeight: "900",
  },

  statusTextDone: {
    color: "#86efac",
  },

  payGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 15,
  },

  payItem: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 11,
  },

  payItemAccent: {
    backgroundColor: "#15173a",
    borderColor: "#3730a3",
  },

  payLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  payValue: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 4,
  },

  payValueAccent: {
    color: "#c7d2fe",
  },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
    paddingTop: 13,
    marginTop: 14,
  },

  securityRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },

  securityText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "800",
    marginLeft: 6,
    flex: 1,
  },

  emptyCard: {
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 28,
  },

  emptyTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 14,
    textAlign: "center",
  },

  emptyText: {
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 6,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(2, 6, 23, 0.7)",
  },

  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },

  sheet: {
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "#1e293b",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 34,
  },

  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  sheetTitleWrap: {
    flex: 1,
    paddingRight: 14,
  },

  sheetTitle: {
    color: "#ffffff",
    fontSize: 25,
    fontWeight: "900",
  },

  sheetSubtitle: {
    color: "#c7d2fe",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 6,
  },

  closeButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dc2626",
  },

  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 13,
    marginBottom: 9,
  },

  detailRowHighlight: {
    borderColor: "#3730a3",
    backgroundColor: "#15173a",
  },

  detailIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020617",
    marginRight: 12,
  },

  detailIconHighlight: {
    backgroundColor: "#1e1b4b",
  },

  detailBody: {
    flex: 1,
    minWidth: 0,
  },

  detailLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  detailValue: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 21,
    marginTop: 3,
  },

  detailValueHighlight: {
    color: "#c7d2fe",
    fontSize: 16,
  },

  missingLinkBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#422006",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#854d0e",
    padding: 13,
    marginBottom: 12,
  },

  missingLinkText: {
    color: "#fde68a",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    marginLeft: 10,
    flex: 1,
  },

  sheetActions: {
    flexDirection: "row",
    gap: 10,
  },

  sheetButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366f1",
    borderRadius: 16,
    paddingVertical: 15,
  },

  sheetButtonSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#3730a3",
    paddingVertical: 15,
  },

  sheetButtonDisabled: {
    opacity: 0.45,
  },

  sheetButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    marginLeft: 7,
  },

  sheetButtonSecondaryText: {
    color: "#c7d2fe",
    fontSize: 14,
    fontWeight: "900",
    marginLeft: 7,
  },
});
