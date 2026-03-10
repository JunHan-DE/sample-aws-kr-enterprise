import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Typography, Paper, Chip, Button, List, ListItem, ListItemText, Card, CardContent, Stack, CircularProgress, Alert } from "@mui/material";

const statusColors = { ANALYZING: "default", PENDING_APPROVAL: "warning", APPROVED: "info", EXECUTING: "secondary", COMPLETED: "success", FAILED: "error", PENDING: "warning", RESOLVED: "success" };
const riskColors = { LOW: "success", MEDIUM: "warning", HIGH: "error" };

export default function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { api.getReport(id).then(setReport).catch(e => setError(e.message)); }, [id]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!report) return <CircularProgress sx={{ mt: 4 }} />;

  const data = report.report_data || {};

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h4" fontWeight={600}>RCA 리포트</Typography>
        <Button variant="outlined" color="error" size="small" onClick={async () => {
          if (window.confirm("이 리포트를 삭제하시겠습니까?")) { await api.deleteReport(id); navigate("/"); }
        }}>삭제</Button>
      </Stack>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }} flexWrap="wrap">
        <Typography variant="body2" color="text.secondary">ID: {report.report_id}</Typography>
        <Chip label={report.status} size="small" color={statusColors[report.status] || "default"} />
        <Typography variant="body2">Alarm: <strong>{report.alarm_name}</strong></Typography>
        <Typography variant="body2" color="text.secondary">{report.created_at}</Typography>
      </Stack>

      {report.status === "ANALYZING" && (
        <Paper elevation={1} sx={{ p: 3, mb: 2, textAlign: "center" }}>
          <CircularProgress sx={{ mb: 1 }} />
          <Typography color="text.secondary">RCA 분석 중... 잠시 후 새로고침 해주세요.</Typography>
        </Paper>
      )}
      {data.summary && report.status !== "ANALYZING" && (
        <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">요약</Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>{data.summary}</Typography>
        </Paper>
      )}

      {data.timeline?.length > 0 && (
        <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>타임라인</Typography>
          <List dense disablePadding>
            {data.timeline.map((t, i) => (
              <ListItem key={i} disableGutters>
                <ListItemText primary={t.event} secondary={t.time} />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {data.root_cause && (
        <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>근본 원인</Typography>
          <Typography>{data.root_cause.description}</Typography>
          <Chip label={`신뢰도: ${data.root_cause.confidence}`} size="small" sx={{ mt: 1 }} />
          {data.root_cause.evidence?.length > 0 && (
            <List dense sx={{ mt: 1 }}>{data.root_cause.evidence.map((e, i) => <ListItem key={i} disableGutters><ListItemText primary={e} primaryTypographyProps={{ variant: "body2" }} /></ListItem>)}</List>
          )}
        </Paper>
      )}

      {data.impact && (
        <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>영향 범위</Typography>
          <Typography>{data.impact.service_impact}</Typography>
          {data.impact.affected_resources?.length > 0 && (
            <List dense>{data.impact.affected_resources.map((r, i) => <ListItem key={i} disableGutters><ListItemText primary={r} primaryTypographyProps={{ variant: "body2", fontFamily: "monospace" }} /></ListItem>)}</List>
          )}
        </Paper>
      )}

      {data.recommended_actions?.length > 0 && (
        <>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>권장 조치</Typography>
          {data.recommended_actions.map(action => (
            <ActionCard key={action.action_id} action={action} reportId={id} onUpdate={() => api.getReport(id).then(setReport)} />
          ))}
        </>
      )}
    </>
  );
}

function ActionCard({ action, reportId, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [localStatus, setLocalStatus] = useState(null);
  const displayStatus = localStatus || action.status;

  const approve = async () => {
    setLoading(true);
    setLocalStatus("EXECUTING");
    try {
      await api.approveAction(reportId, action.action_id);
      // Poll for completion
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 5000));
        try {
          const report = await api.getReport(reportId);
          const a = (report.report_data?.recommended_actions || []).find(a => a.action_id === action.action_id);
          if (a && a.status !== "EXECUTING") {
            setLocalStatus(null);
            onUpdate();
            setLoading(false);
            return;
          }
        } catch {}
      }
      setLocalStatus(null);
      onUpdate();
    } catch (e) { alert(e.message); setLocalStatus(null); }
    setLoading(false);
  };

  return (
    <Card elevation={1} sx={{ mb: 1 }} data-testid={`action-${action.action_id}`}>
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" fontWeight={600}>#{action.priority}</Typography>
            <Typography variant="body2">{action.description}</Typography>
            <Chip label={action.risk_level} size="small" color={riskColors[action.risk_level] || "default"} />
          </Stack>
          {(displayStatus === "PENDING_APPROVAL" || displayStatus === "FAILED")
            ? <Button variant="contained" size="small" onClick={approve} disabled={loading} color={displayStatus === "FAILED" ? "error" : "primary"}
                data-testid={`approve-${action.action_id}`}>{loading ? "실행 중..." : displayStatus === "FAILED" ? "재시도" : "승인 및 실행"}</Button>
            : displayStatus === "EXECUTING"
            ? <Chip label="실행 중..." size="small" color="secondary" />
            : <Chip label={displayStatus} size="small" color={statusColors[displayStatus] || "default"} />}
        </Stack>
        {action.command && (
          <Paper variant="outlined" sx={{ mt: 1, p: 1, bgcolor: "grey.900", borderRadius: 1 }}>
            <Typography variant="caption" color="grey.500">CLI 명령어</Typography>
            <Typography variant="body2" sx={{ fontFamily: "monospace", color: "#4fc3f7", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{action.command}</Typography>
          </Paper>
        )}
        {action.code && (
          <Paper variant="outlined" sx={{ mt: 0.5, p: 1, bgcolor: "grey.900", borderRadius: 1 }}>
            <Typography variant="caption" color="grey.500">Python 코드</Typography>
            <Typography variant="body2" sx={{ fontFamily: "monospace", color: "#81c784", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{action.code}</Typography>
          </Paper>
        )}
        {action.execution_result && (
          <Alert severity={action.status === "COMPLETED" ? "success" : "error"} sx={{ mt: 1, "& p": { m: 0 }, "& pre": { bgcolor: "rgba(0,0,0,0.06)", p: 1, borderRadius: 1, overflow: "auto" }, "& code": { fontSize: "0.85em" } }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{action.execution_result}</ReactMarkdown>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
