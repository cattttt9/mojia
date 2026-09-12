package com.inkshelf.web;

import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.security.SecureRandom;

@RestController
@RequestMapping("/api/public")
/** 无需登录即可查看的隐私和数据使用摘要。 */
public class PublicInfoController {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final List<Quote> QUOTES = Arrays.asList(
            new Quote("lunyu-thinking", "学而不思则罔，思而不学则殆。", "孔子", "《论语》"),
            new Quote("lunyu-joy", "知之者不如好之者，好之者不如乐之者。", "孔子", "《论语》"),
            new Quote("lisao-road", "路漫漫其修远兮，吾将上下而求索。", "屈原", "《离骚》"),
            new Quote("zhongyong-study", "博学之，审问之，慎思之，明辨之，笃行之。", "子思", "《中庸》"),
            new Quote("luyou-practice", "纸上得来终觉浅，绝知此事要躬行。", "陆游", "《冬夜读书示子聿》"),
            new Quote("bailudong-time", "读书不觉已春深，一寸光阴一寸金。", "王贞白", "《白鹿洞二首》"),
            new Quote("sushi-reread", "旧书不厌百回读，熟读深思子自知。", "苏轼", "《送安惇秀才失解西归》"),
            new Quote("zhuxi-source", "问渠那得清如许？为有源头活水来。", "朱熹", "《观书有感》")
    );

    @GetMapping("/privacy")
    public Map<String, Object> privacy() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("keyUsage", "API Key 仅用于代表用户请求微信读书数据，采用 AES-256-GCM 加密保存，不会公开展示或写入日志。");
        m.put("dataUsage", "公开区域只展示用户主动发布的留言；个人书架和阅读数据默认私密。");
        m.put("deletion", "用户可随时解除绑定并删除已保存的 API Key；注销流程上线前必须提供。");
        m.put("notice", "请勿在留言中发布 API Key、密码、邮箱或其他敏感信息。");
        return m;
    }

    /** 登录窗口使用的公开短句；exclude 用于保证连续两次打开时不重复。 */
    @GetMapping("/daily-quote")
    public Map<String, Object> dailyQuote(@RequestParam(value = "exclude", required = false) String exclude) {
        List<Quote> candidates = new ArrayList<>();
        for (Quote quote : QUOTES) if (!quote.id.equals(exclude)) candidates.add(quote);
        Quote quote = candidates.get(RANDOM.nextInt(candidates.size()));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", quote.id);
        result.put("text", quote.text);
        result.put("author", quote.author);
        result.put("work", quote.work);
        return result;
    }

    private static class Quote {
        final String id, text, author, work;
        Quote(String id, String text, String author, String work) { this.id = id; this.text = text; this.author = author; this.work = work; }
    }
}
