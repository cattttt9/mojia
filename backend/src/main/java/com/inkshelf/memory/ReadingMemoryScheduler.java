package com.inkshelf.memory;

import com.inkshelf.weread.WeReadCredentialRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 每天低频检查一次缺失报告；服务只会为最近完整周/月补生成。
 */
@Component
public class ReadingMemoryScheduler {
    private final WeReadCredentialRepository credentials;
    private final ReadingMemoryService memory;

    public ReadingMemoryScheduler(WeReadCredentialRepository c, ReadingMemoryService m) {
        credentials = c;
        memory = m;
    }

    @Scheduled(cron = "0 35 3 * * *", zone = "Asia/Shanghai")
    public void generateMissingReports() {
        credentials.findAll().forEach(value -> {
            try {
                memory.latestReport(value.getUserId(), "WEEKLY");
                memory.latestReport(value.getUserId(), "MONTHLY");
            } catch (Exception ignored) {/* 下次计划任务或用户进入页面时继续补生成。 */}
        });
    }
}
