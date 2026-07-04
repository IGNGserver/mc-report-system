package cn.lvziw.mcserver.report.command;

import cn.lvziw.mcserver.report.ReportPlugin;
import cn.lvziw.mcserver.report.database.DatabaseManager;
import cn.lvziw.mcserver.report.database.ReportRecord;
import cn.lvziw.mcserver.report.database.ReportTarget;
import com.mojang.brigadier.Command;
import com.mojang.brigadier.Message;
import com.mojang.brigadier.arguments.StringArgumentType;
import io.papermc.paper.command.brigadier.CommandSourceStack;
import io.papermc.paper.command.brigadier.Commands;
import io.papermc.paper.command.brigadier.MessageComponentSerializer;
import io.papermc.paper.plugin.lifecycle.event.types.LifecycleEvents;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import net.kyori.adventure.text.event.HoverEvent;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

public final class ReportCommands {
    private static final List<VisibilityOption> VISIBILITY_OPTIONS = List.of(
        new VisibilityOption("admin", "所有管理员可见"),
        new VisibilityOption("superadmin", "仅超级管理员可见")
    );

    private ReportCommands() {
    }

    public static void register(ReportPlugin plugin, DatabaseManager databaseManager) {
        plugin.getLifecycleManager().registerEventHandler(LifecycleEvents.COMMANDS, commands -> {
            var command = Commands.literal("report")
                .requires(source -> source.getSender().hasPermission("mcreport.use"))
                .executes(context -> {
                    sendHelp(context.getSource().getSender());
                    return Command.SINGLE_SUCCESS;
                })
                .then(Commands.literal("help")
                    .executes(context -> {
                        sendHelp(context.getSource().getSender());
                        return Command.SINGLE_SUCCESS;
                    }))
                .then(Commands.literal("create")
                    .then(Commands.argument("visibility", StringArgumentType.word())
                        .suggests((context, builder) -> {
                            String remaining = builder.getRemainingLowerCase();
                            for (VisibilityOption option : VISIBILITY_OPTIONS) {
                                if (option.key().startsWith(remaining)) {
                                    builder.suggest(option.key(), tooltip(option.description()));
                                }
                            }
                            return builder.buildFuture();
                        })
                        .then(Commands.argument("targets", StringArgumentType.string())
                            .suggests((context, builder) -> {
                                String remaining = builder.getRemainingLowerCase();
                                for (Player player : Bukkit.getOnlinePlayers()) {
                                    String name = player.getName();
                                    if (name.toLowerCase(Locale.ROOT).startsWith(remaining)) {
                                        builder.suggest(name, tooltip("当前在线玩家，可直接作为举报对象"));
                                    }
                                }
                                if (remaining.isEmpty()) {
                                    builder.suggest("\"玩家A,玩家B\"", tooltip("多个举报对象请用英文逗号分隔，并用双引号包起来；也可以填写离线玩家名"));
                                }
                                return builder.buildFuture();
                            })
                            .then(Commands.argument("reason", StringArgumentType.greedyString())
                                .suggests((context, builder) -> {
                                    if (builder.getRemaining().isEmpty()) {
                                        builder.suggest("请用中文填写举报理由", tooltip("例如：在主城恶意骚扰、刷屏辱骂、恶意破坏建筑"));
                                    }
                                    return builder.buildFuture();
                                })
                                .executes(context -> submitReport(
                                    plugin,
                                    databaseManager,
                                    context.getSource().getSender(),
                                    StringArgumentType.getString(context, "visibility"),
                                    StringArgumentType.getString(context, "targets"),
                                    StringArgumentType.getString(context, "reason")
                                ))))))
                .build();

            commands.registrar().register(
                command,
                "提交游戏内举报，支持中文帮助、候选词提示和离线玩家",
                List.of("mcreport")
            );
        });
    }

    private static int submitReport(
        ReportPlugin plugin,
        DatabaseManager databaseManager,
        CommandSender sender,
        String rawVisibility,
        String rawTargets,
        String rawReason
    ) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage("只有玩家可以使用这个指令。");
            return Command.SINGLE_SUCCESS;
        }

        String visibility = rawVisibility.toLowerCase(Locale.ROOT);
        if (VISIBILITY_OPTIONS.stream().noneMatch(option -> option.key().equals(visibility))) {
            player.sendMessage(Component.text("举报可见范围只能是 admin 或 superadmin。", NamedTextColor.RED));
            return Command.SINGLE_SUCCESS;
        }

        List<ReportTarget> targets = parseTargets(rawTargets);
        if (targets.isEmpty()) {
            player.sendMessage(Component.text("请至少填写一个举报对象，多个名字请用英文逗号分隔。", NamedTextColor.RED));
            return Command.SINGLE_SUCCESS;
        }

        String reason = rawReason.trim();
        if (reason.isEmpty()) {
            player.sendMessage(Component.text("举报理由不能为空，请用中文填写。", NamedTextColor.RED));
            return Command.SINGLE_SUCCESS;
        }

        ReportRecord record = new ReportRecord(
            player.getUniqueId().toString(),
            player.getName(),
            visibility,
            reason
        );

        plugin.getServer().getAsyncScheduler().runNow(plugin, task -> {
            try {
                databaseManager.saveReport(record, targets);
                player.getScheduler().run(plugin, scheduledTask ->
                    player.sendMessage(Component.text("举报已提交成功，管理员稍后会处理。", NamedTextColor.GREEN)), null);
            } catch (SQLException exception) {
                plugin.getLogger().warning("写入举报失败: " + exception.getMessage());
                player.getScheduler().run(plugin, scheduledTask ->
                    player.sendMessage(Component.text("举报提交失败，请联系管理员检查数据库配置。", NamedTextColor.RED)), null);
            }
        });

        return Command.SINGLE_SUCCESS;
    }

    private static List<ReportTarget> parseTargets(String rawTargets) {
        List<ReportTarget> targets = new ArrayList<>();
        for (String part : rawTargets.split(",")) {
            String name = part.trim();
            if (name.isEmpty()) {
                continue;
            }

            OfflinePlayer offlinePlayer = Bukkit.getOfflinePlayer(name);
            UUID uuid = offlinePlayer.getUniqueId();
            targets.add(new ReportTarget(uuid != null ? uuid.toString() : null, name));
        }
        return targets;
    }

    private static void sendHelp(CommandSender sender) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage("/report create <admin|superadmin> <玩家1,玩家2> <理由>");
            return;
        }

        player.sendMessage(Component.text("举报功能说明", NamedTextColor.GOLD));
        player.sendMessage(
            Component.text("/report create <admin|superadmin> <玩家1> <理由>", NamedTextColor.YELLOW)
                .hoverEvent(HoverEvent.showText(Component.text("单个举报对象可直接填写。多个举报对象请用英文逗号分隔，并用双引号包起来；支持离线玩家名。", NamedTextColor.WHITE)))
                .clickEvent(ClickEvent.suggestCommand("/report create admin \"玩家A,玩家B\" 在主城恶意骚扰"))
        );
        player.sendMessage(Component.text("候选词说明：", NamedTextColor.AQUA));
        player.sendMessage(Component.text("admin：所有管理员可见。", NamedTextColor.GRAY));
        player.sendMessage(Component.text("superadmin：仅超级管理员可见。", NamedTextColor.GRAY));
        player.sendMessage(Component.text("举报对象：单个玩家可直接填写；多个名字请用英文逗号分隔并用双引号包起来，也支持离线玩家名。", NamedTextColor.GRAY));
        player.sendMessage(Component.text("举报理由：请直接用中文填写具体情况。", NamedTextColor.GRAY));
    }

    private static Message tooltip(String text) {
        return MessageComponentSerializer.message().serialize(
            MiniMessage.miniMessage().deserialize("<gray>" + escapeMiniMessage(text) + "</gray>")
        );
    }

    private static String escapeMiniMessage(String text) {
        return text.replace("<", "&lt;").replace(">", "&gt;");
    }

    private record VisibilityOption(String key, String description) {
    }
}
