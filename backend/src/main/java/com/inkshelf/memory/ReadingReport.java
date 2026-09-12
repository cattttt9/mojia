package com.inkshelf.memory;

import org.hibernate.annotations.ColumnTransformer;

import javax.persistence.*;
import java.time.*;

/**
 * 周报/月报的私密快照；同一用户和周期只保留一个稳定版本。
 */
@Entity
@Table(name = "reading_report", uniqueConstraints = @UniqueConstraint(name = "uk_reading_report_user_period", columnNames = {"user_id", "period_type", "period_start"}))
public class ReadingReport {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", nullable = false)
    private Long userId;
    @Column(name = "period_type", nullable = false, length = 16)
    private String periodType;
    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;
    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;
    @Column(name = "report_json", nullable = false, columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String reportJson;
    @Column(name = "share_json", nullable = false, columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String shareJson;
    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt = Instant.now();
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long v) {
        userId = v;
    }

    public String getPeriodType() {
        return periodType;
    }

    public void setPeriodType(String v) {
        periodType = v;
    }

    public LocalDate getPeriodStart() {
        return periodStart;
    }

    public void setPeriodStart(LocalDate v) {
        periodStart = v;
    }

    public LocalDate getPeriodEnd() {
        return periodEnd;
    }

    public void setPeriodEnd(LocalDate v) {
        periodEnd = v;
    }

    public String getReportJson() {
        return reportJson;
    }

    public void setReportJson(String v) {
        reportJson = v;
    }

    public String getShareJson() {
        return shareJson;
    }

    public void setShareJson(String v) {
        shareJson = v;
    }

    public Instant getGeneratedAt() {
        return generatedAt;
    }

    public void setGeneratedAt(Instant v) {
        generatedAt = v;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant v) {
        updatedAt = v;
    }
}
