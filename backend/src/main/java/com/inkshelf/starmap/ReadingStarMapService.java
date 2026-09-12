package com.inkshelf.starmap;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.*;
import java.util.*;

/** 阅读星图 V1：持久化书籍画像，实时计算规则/主题关系，并应用用户隐藏决策。 */
@Service
public class ReadingStarMapService {
    private static final Logger log = LoggerFactory.getLogger(ReadingStarMapService.class);
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final ReadingStarMapAiService ai;
    private final int maxBooks;
    private final int maxRelations;
    private final int samePeriodDays;

    public ReadingStarMapService(JdbcTemplate jdbc, ObjectMapper json, ReadingStarMapAiService ai,
                                 @Value("${inkshelf.star-map.max-books:60}") int maxBooks,
                                 @Value("${inkshelf.star-map.max-relations:120}") int maxRelations,
                                 @Value("${inkshelf.star-map.same-period-days:30}") int samePeriodDays) {
        this.jdbc = jdbc; this.json = json; this.ai = ai;
        this.maxBooks = Math.max(3, Math.min(120, maxBooks));
        this.maxRelations = Math.max(10, Math.min(300, maxRelations));
        this.samePeriodDays = Math.max(1, Math.min(180, samePeriodDays));
    }

    @Transactional
    public void sync(Long userId, List<ReadingStarMapController.BookInput> books) {
        if (books == null) return;
        String sql = "INSERT INTO reading_star_book_profile(user_id,book_id,title,author,category,cover_url,finished,last_read_at,reading_progress,is_top,themes_json,theme_source,updated_at) " +
                "VALUES (?,?,?,?,?,?,?,?,?,?,CAST(? AS jsonb),'SYSTEM',NOW()) ON CONFLICT(user_id,book_id) DO UPDATE SET " +
                "title=EXCLUDED.title,author=EXCLUDED.author,category=EXCLUDED.category,cover_url=EXCLUDED.cover_url,finished=EXCLUDED.finished,last_read_at=EXCLUDED.last_read_at,reading_progress=GREATEST(reading_star_book_profile.reading_progress,EXCLUDED.reading_progress),is_top=EXCLUDED.is_top,updated_at=NOW()";
        for (ReadingStarMapController.BookInput book : books) {
            List<String> fallback = Collections.singletonList(systemTheme(book.category));
            jdbc.update(sql, userId, book.id, clean(book.title, 300), clean(book.author, 300), clean(book.category, 300), clean(book.cover, 2000),
                    book.finished, book.lastRead == null || book.lastRead <= 0 ? null : Timestamp.from(Instant.ofEpochMilli(book.lastRead)),
                    book.progress == null ? 0 : book.progress, book.top, write(fallback));
        }
    }

    public Map<String, Object> analyzeThemes(Long userId) {
        List<Book> candidates = books(userId, 24, null);
        try {
            List<Map<String, Object>> input = new ArrayList<>();
            for (Book book : candidates) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("bookId", book.id); item.put("title", book.title); item.put("author", book.author); item.put("category", book.category);
                item.put("noteCount", book.noteCount); item.put("highlightCount", book.highlightCount); input.add(item);
            }
            Map<String, ReadingStarMapAiService.ThemeResult> results = ai.analyze(input);
            for (Map.Entry<String, ReadingStarMapAiService.ThemeResult> entry : results.entrySet()) {
                jdbc.update("UPDATE reading_star_book_profile SET themes_json=CAST(? AS jsonb),theme_source='AI',ai_summary=?,analyzed_at=NOW(),updated_at=NOW() WHERE user_id=? AND book_id=?",
                        write(entry.getValue().themes), entry.getValue().summary, userId, entry.getKey());
            }
            return graph(userId, results.isEmpty() ? "书籍信息不足，当前继续展示规则图谱" : "AI 主题已更新", null);
        } catch (Exception error) {
            // 只记录异常类型，不记录书籍、笔记、Authorization 或 AI 请求正文。
            log.warn("Star map theme analysis failed, userId={}, error={}", userId, error.getClass().getSimpleName());
            return graph(userId, "AI 主题暂不可用，当前展示作者、分类和同期阅读形成的规则图谱", null);
        }
    }

    @Transactional
    public void hide(Long userId, String left, String right) {
        if (left.equals(right)) throw new IllegalArgumentException("不能隐藏书籍自身关系");
        String a = left.compareTo(right) < 0 ? left : right, b = left.compareTo(right) < 0 ? right : left;
        jdbc.update("INSERT INTO reading_star_hidden_relation(user_id,source_book_id,target_book_id) VALUES (?,?,?) ON CONFLICT(user_id,source_book_id,target_book_id) DO NOTHING", userId, a, b);
    }

    public Map<String, Object> graph(Long userId, String message, String query) {
        List<Book> books = books(userId, maxBooks, query);
        Set<String> hidden = new HashSet<>(jdbc.query("SELECT source_book_id,target_book_id FROM reading_star_hidden_relation WHERE user_id=?",
                (rs, row) -> rs.getString(1) + "\n" + rs.getString(2), userId));
        List<Edge> relations = relations(books, hidden);
        LinkedHashMap<String, Theme> themes = new LinkedHashMap<>();
        for (Book book : books) for (String name : book.themes) themes.computeIfAbsent(name, key -> new Theme(key, book.themeSource)).count++;

        List<Map<String, Object>> nodes = new ArrayList<>(), edges = new ArrayList<>();
        for (Book book : books) nodes.add(bookNode(book, relations));
        for (Theme theme : themes.values()) nodes.add(themeNode(theme));
        for (Edge edge : relations) edges.add(edge.view());
        for (Book book : books) for (String theme : book.themes) edges.add(themeEdge(book.id, theme, book.themeSource));

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("bookCount", books.size()); stats.put("themeCount", themes.size()); stats.put("relationCount", relations.size());
        stats.put("densestBook", densest(books, relations));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("nodes", nodes); result.put("edges", edges); result.put("stats", stats);
        result.put("smartStatus", message == null ? (hasAi(books) ? "AI 主题与规则关系已加载" : "当前展示规则图谱，可生成 AI 主题") : message);
        result.put("aiEnhanced", hasAi(books));
        return result;
    }

    private List<Book> books(Long userId, int limit, String query) {
        Map<String, Counts> counts = new HashMap<>();
        jdbc.query("SELECT book_id,note_count,bookmark_count,reading_progress FROM weread_notebook WHERE user_id=?", (org.springframework.jdbc.core.RowCallbackHandler) rs ->
                counts.put(rs.getString(1), new Counts(rs.getInt(2), rs.getInt(3), rs.getInt(4))), userId);
        List<Book> all = jdbc.query("SELECT book_id,title,author,category,cover_url,finished,last_read_at,themes_json::text,theme_source,ai_summary,reading_progress,is_top,first_seen_at FROM reading_star_book_profile WHERE user_id=? ORDER BY title LIMIT 500",
                (rs, row) -> {
                    Counts c = counts.getOrDefault(rs.getString(1), new Counts(0, 0, 0));
                    return new Book(rs.getString(1), rs.getString(2), value(rs.getString(3), "佚名"), value(rs.getString(4), "未分类"), rs.getString(5), rs.getBoolean(6),
                            rs.getTimestamp(7) == null ? null : rs.getTimestamp(7).toInstant(), readThemes(rs.getString(8)), rs.getString(9), rs.getString(10), c.notes, c.highlights,
                            Math.max(rs.getInt(11), c.progress), rs.getBoolean(12), rs.getTimestamp(13).toInstant());
                }, userId);
        String normalized = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        if (normalized.length() > 80) normalized = normalized.substring(0, 80);
        Instant now = Instant.now();
        for (Book book : all) {
            book.searchMatched = !normalized.isEmpty() && (book.title.toLowerCase(Locale.ROOT).contains(normalized) || book.author.toLowerCase(Locale.ROOT).contains(normalized));
            book.rankScore = rank(book, now) + (book.searchMatched ? 10000 : 0);
        }
        all.sort((left, right) -> { int score = Integer.compare(right.rankScore, left.rankScore); return score != 0 ? score : left.title.compareToIgnoreCase(right.title); });
        return all.subList(0, Math.min(limit, all.size()));
    }

    /** 可解释的入图权重：近期行为优先，同时保留读完、接近读完、置顶和笔记活跃书籍。 */
    private int rank(Book book, Instant now) {
        int score = book.top ? 320 : 0;
        long readDays = book.lastRead == null ? Long.MAX_VALUE : Math.max(0, Duration.between(book.lastRead, now).toDays());
        if (readDays <= 14) score += 300; else if (readDays <= 30) score += 250; else if (readDays <= 90) score += 180; else if (readDays <= 365) score += 90; else if (book.lastRead != null) score += 35;
        if (book.finished && readDays <= 90) score += 230; else if (book.progress >= 80 && !book.finished) score += 210; else if (book.finished) score += 130; else if (book.progress >= 20) score += 125; else if (book.progress > 0) score += 70;
        score += Math.min(120, book.noteCount * 8 + book.highlightCount * 2);
        long seenDays = Math.max(0, Duration.between(book.firstSeen, now).toDays());
        if (seenDays <= 14) score += 75; else if (seenDays <= 60) score += 35;
        return score;
    }

    private List<Edge> relations(List<Book> books, Set<String> hidden) {
        List<Edge> all = new ArrayList<>();
        for (int i = 0; i < books.size(); i++) for (int j = i + 1; j < books.size(); j++) {
            Book a = books.get(i), b = books.get(j); String pair = ordered(a.id, b.id);
            if (hidden.contains(pair)) continue;
            List<String> types = new ArrayList<>(), shared = new ArrayList<>(); double score = 0;
            if (!a.author.equals("佚名") && a.author.equalsIgnoreCase(b.author)) { types.add("同一作者"); score = Math.max(score, .88); }
            if (!a.category.equals("未分类") && a.category.equalsIgnoreCase(b.category)) { types.add("同一分类"); score = Math.max(score, .68); }
            if (a.lastRead != null && b.lastRead != null && Math.abs(Duration.between(a.lastRead, b.lastRead).toDays()) <= samePeriodDays) { types.add("同期阅读"); score = Math.max(score, .58); }
            for (String theme : a.themes) if (b.themes.contains(theme)) shared.add(theme);
            if (!shared.isEmpty() && ("AI".equals(a.themeSource) || "AI".equals(b.themeSource))) { types.add("主题相近"); score = Math.max(score, Math.min(.92, .72 + shared.size() * .06)); }
            if (types.isEmpty()) continue;
            score = Math.min(.98, score + Math.max(0, types.size() - 1) * .05);
            all.add(new Edge(a, b, types, shared, score));
        }
        all.sort((a, b) -> Double.compare(b.score, a.score));
        return all.subList(0, Math.min(maxRelations, all.size()));
    }

    private Map<String, Object> bookNode(Book b, List<Edge> edges) {
        Map<String, Object> m = new LinkedHashMap<>(); m.put("id", "book:" + b.id); m.put("bookId", b.id); m.put("kind", "BOOK"); m.put("label", b.title);
        m.put("title", b.title); m.put("author", b.author); m.put("category", b.category); m.put("cover", b.cover); m.put("finished", b.finished);
        m.put("lastRead", b.lastRead == null ? null : b.lastRead.toString()); m.put("themes", b.themes); m.put("themeSource", b.themeSource); m.put("summary", b.summary);
        m.put("noteCount", b.noteCount); m.put("highlightCount", b.highlightCount); m.put("progress", b.progress); m.put("top", b.top);
        m.put("rankScore", b.rankScore); m.put("rankReason", rankReason(b)); m.put("searchMatched", b.searchMatched);
        m.put("relatedCount", edges.stream().filter(e -> e.a.id.equals(b.id) || e.b.id.equals(b.id)).count()); return m;
    }
    private Map<String, Object> themeNode(Theme t) { Map<String,Object> m=new LinkedHashMap<>();m.put("id","theme:"+t.name);m.put("kind","THEME");m.put("label",t.name);m.put("source",t.source);m.put("bookCount",t.count);return m; }
    private Map<String, Object> themeEdge(String bookId, String theme, String source) { Map<String,Object> m=new LinkedHashMap<>();m.put("id","topic:"+bookId+":"+theme);m.put("source","book:"+bookId);m.put("target","theme:"+theme);m.put("kind","BOOK_THEME");m.put("types",Collections.singletonList("AI".equals(source)?"AI主题":"分类主题"));m.put("score",.7);m.put("explanation","这本书被归入“"+theme+"”主题");return m; }
    private Map<String, Object> densest(List<Book> books, List<Edge> edges) { Book best=null;long max=-1;for(Book b:books){long count=edges.stream().filter(e->e.a.id.equals(b.id)||e.b.id.equals(b.id)).count();if(count>max){best=b;max=count;}}Map<String,Object> m=new LinkedHashMap<>();if(best!=null){m.put("bookId",best.id);m.put("title",best.title);m.put("connections",max);}return m; }
    private boolean hasAi(List<Book> books) { for (Book b : books) if ("AI".equals(b.themeSource)) return true; return false; }
    private String rankReason(Book b) {
        if (b.searchMatched) return "搜索命中";
        if (b.top) return "书架置顶";
        if (b.lastRead != null && Duration.between(b.lastRead, Instant.now()).toDays() <= 30) return b.finished ? "最近读完" : "最近正在读";
        if (!b.finished && b.progress >= 80) return "接近读完";
        if (b.finished) return "已经读完";
        if (b.progress > 0) return "读过一部分";
        return "近期进入墨架";
    }
    private String systemTheme(String category) { String value=value(category,"未分类");String[] parts=value.split("[-·/]");return clean(parts[parts.length-1],24); }
    private String ordered(String a,String b){return a.compareTo(b)<0?a+"\n"+b:b+"\n"+a;}
    private String clean(String value,int max){if(value==null)return null;String v=value.trim();return v.substring(0,Math.min(max,v.length()));}
    private String value(String value,String fallback){return value==null||value.trim().isEmpty()?fallback:value.trim();}
    private String write(Object value){try{return json.writeValueAsString(value);}catch(Exception e){return "[]";}}
    private List<String> readThemes(String value){try{return json.readValue(value,new TypeReference<List<String>>(){});}catch(Exception e){return Collections.emptyList();}}

    private static class Counts { final int notes,highlights,progress; Counts(int notes,int highlights,int progress){this.notes=notes;this.highlights=highlights;this.progress=progress;} }
    private static class Theme { final String name,source; int count; Theme(String name,String source){this.name=name;this.source=source;} }
    private static class Book { final String id,title,author,category,cover,themeSource,summary;final boolean finished,top;final Instant lastRead,firstSeen;final List<String> themes;final int noteCount,highlightCount,progress;int rankScore;boolean searchMatched;Book(String id,String title,String author,String category,String cover,boolean finished,Instant lastRead,List<String> themes,String themeSource,String summary,int noteCount,int highlightCount,int progress,boolean top,Instant firstSeen){this.id=id;this.title=title;this.author=author;this.category=category;this.cover=cover;this.finished=finished;this.lastRead=lastRead;this.themes=themes;this.themeSource=themeSource;this.summary=summary;this.noteCount=noteCount;this.highlightCount=highlightCount;this.progress=progress;this.top=top;this.firstSeen=firstSeen;} }
    private static class Edge { final Book a,b;final List<String> types,shared;final double score;Edge(Book a,Book b,List<String> types,List<String> shared,double score){this.a=a;this.b=b;this.types=types;this.shared=shared;this.score=score;}Map<String,Object> view(){Map<String,Object> m=new LinkedHashMap<>();m.put("id","relation:"+a.id+":"+b.id);m.put("source","book:"+a.id);m.put("target","book:"+b.id);m.put("sourceBookId",a.id);m.put("targetBookId",b.id);m.put("kind","BOOK_RELATION");m.put("types",types);m.put("sharedThemes",shared);m.put("score",score);String basis=String.join("、",types);String explanation=shared.isEmpty()?"两本书因“"+basis+"”形成连接。":"两本书共同关联“"+String.join("、",shared)+"”，并因“"+basis+"”形成连接。";m.put("explanation",explanation);return m;} }
}
