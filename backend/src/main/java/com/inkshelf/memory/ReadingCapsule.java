package com.inkshelf.memory;

import org.hibernate.annotations.ColumnTransformer;

import javax.persistence.*;
import java.time.*;

/**
 * 某一周展示的私人时间胶囊，内容在生成时冻结。
 */
@Entity
@Table(name = "reading_capsule", uniqueConstraints = @UniqueConstraint(name = "uk_reading_capsule_user_date", columnNames = {"user_id", "capsule_date"}))
public class ReadingCapsule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", nullable = false)
    private Long userId;
    @Column(name = "capsule_date", nullable = false)
    private LocalDate capsuleDate;
    @Column(name = "source_date", nullable = false)
    private LocalDate sourceDate;
    @Column(name = "source_type", nullable = false, length = 24)
    private String sourceType;
    @Column(name = "source_book_id", length = 64)
    private String sourceBookId;
    @Column(name = "source_note_id")
    private Long sourceNoteId;
    @Column(name = "content_json", nullable = false, columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String contentJson;
    @Column(nullable = false, length = 16)
    private String status = "READY";
    @Column(name = "shown_at")
    private Instant shownAt;
    @Column(name = "dismissed_at")
    private Instant dismissedAt;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long v) {
        userId = v;
    }

    public LocalDate getCapsuleDate() {
        return capsuleDate;
    }

    public void setCapsuleDate(LocalDate v) {
        capsuleDate = v;
    }

    public LocalDate getSourceDate() {
        return sourceDate;
    }

    public void setSourceDate(LocalDate v) {
        sourceDate = v;
    }

    public String getSourceType() {
        return sourceType;
    }

    public void setSourceType(String v) {
        sourceType = v;
    }

    public String getSourceBookId() {
        return sourceBookId;
    }

    public void setSourceBookId(String v) {
        sourceBookId = v;
    }

    public Long getSourceNoteId() {
        return sourceNoteId;
    }

    public void setSourceNoteId(Long v) {
        sourceNoteId = v;
    }

    public String getContentJson() {
        return contentJson;
    }

    public void setContentJson(String v) {
        contentJson = v;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String v) {
        status = v;
    }

    public Instant getShownAt() {
        return shownAt;
    }

    public void setShownAt(Instant v) {
        shownAt = v;
    }

    public Instant getDismissedAt() {
        return dismissedAt;
    }

    public void setDismissedAt(Instant v) {
        dismissedAt = v;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
