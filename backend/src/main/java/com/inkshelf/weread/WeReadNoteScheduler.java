package com.inkshelf.weread;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 每日低频更新笔记本概览，并优先刷新最近有笔记的三本书。
 */
@Component
public class WeReadNoteScheduler {
    private final WeReadCredentialRepository credentials;
    private final WeReadNotebookRepository notebooks;
    private final WeReadNoteService notes;

    public WeReadNoteScheduler(WeReadCredentialRepository c, WeReadNotebookRepository n, WeReadNoteService s) {
        credentials = c;
        notebooks = n;
        notes = s;
    }

    @Scheduled(cron = "0 15 3 * * *", zone = "Asia/Shanghai")
    public void refreshRecentNotes() {
        credentials.findAll().forEach(credential -> {
            Long userId = credential.getUserId();
            try {
                notes.syncOverview(userId, false);
                List<WeReadNotebook> recent = notebooks.findByUserIdOrderBySourceSortDesc(userId);
                for (int i = 0; i < Math.min(3, recent.size()); i++)
                    notes.syncBook(userId, recent.get(i).getBookId(), false);
            } catch (Exception ignored) {/* 状态表已经记录脱敏错误码，定时任务下次会重试。 */}
        });
    }
}
