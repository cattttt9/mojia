package com.inkshelf.weread;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * 将已经完整拉取的数据以单个事务写入，避免分页中途失败留下半份笔记。
 */
@Service
public class WeReadNotePersistenceService {
    private final WeReadNotebookRepository notebooks;
    private final WeReadNoteRepository notes;

    public WeReadNotePersistenceService(WeReadNotebookRepository n, WeReadNoteRepository r) {
        notebooks = n;
        notes = r;
    }

    @Transactional
    public void saveNotebooks(List<WeReadNotebook> values) {
        for (WeReadNotebook incoming : values) {
            WeReadNotebook target = notebooks.findByUserIdAndBookId(incoming.getUserId(), incoming.getBookId()).orElse(incoming);
            if (target != incoming) {
                target.setTitle(incoming.getTitle());
                target.setAuthor(incoming.getAuthor());
                target.setCoverUrl(incoming.getCoverUrl());
                target.setReviewCount(incoming.getReviewCount());
                target.setNoteCount(incoming.getNoteCount());
                target.setBookmarkCount(incoming.getBookmarkCount());
                target.setReadingProgress(incoming.getReadingProgress());
                target.setMarkedStatus(incoming.getMarkedStatus());
                target.setSourceSort(incoming.getSourceSort());
                target.setSyncedAt(incoming.getSyncedAt());
            }
            notebooks.save(target);
        }
    }

    @Transactional
    public void replaceNotes(Long userId, String bookId, List<WeReadNote> values) {
        notes.deleteByUserIdAndBookId(userId, bookId);
        notes.flush();
        notes.saveAll(values);
    }
}
