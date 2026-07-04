package cn.lvziw.mcserver.report;

import cn.lvziw.mcserver.report.command.ReportCommands;
import cn.lvziw.mcserver.report.database.DatabaseManager;
import org.bukkit.plugin.java.JavaPlugin;

public final class ReportPlugin extends JavaPlugin {
    private DatabaseManager databaseManager;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        this.databaseManager = new DatabaseManager(this);
        this.databaseManager.initialize();
        ReportCommands.register(this, databaseManager);
    }

    @Override
    public void onDisable() {
        if (databaseManager != null) {
            databaseManager.close();
        }
    }
}
