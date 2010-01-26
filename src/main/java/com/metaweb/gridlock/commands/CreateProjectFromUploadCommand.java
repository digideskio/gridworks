package com.metaweb.gridlock.commands;

import java.io.IOException;
import java.util.Properties;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.metaweb.gridlock.ProjectManager;
import com.metaweb.gridlock.ProjectMetadata;
import com.metaweb.gridlock.model.Cell;
import com.metaweb.gridlock.model.Column;
import com.metaweb.gridlock.model.Project;
import com.metaweb.gridlock.model.Row;

public class CreateProjectFromUploadCommand extends Command {
	@Override
	public void doPost(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {
		
		Properties properties = new Properties();
		String content = readFileUpload(request, properties);
		
		ProjectMetadata pm = new ProjectMetadata();
		pm.name = properties.getProperty("project-name");
		pm.password = properties.getProperty("project-password");
		
		Project project = ProjectManager.singleton.createProject(pm);
		
		int start = 0;
		String sep = null;
		String line = null;
		boolean first = true;
		int cellCount = 1;
		
		while (start < content.length()) {
			int newline = content.indexOf('\n', start);
			if (newline < 0) {
				line = content.substring(start);
				start = content.length();
			} else {
				line = content.substring(start, newline);
				start = newline + 1;
			}
			
			if (sep == null) {
				int tab = line.indexOf('\t');
				if (tab >= 0) {
					sep = "\t";
				} else {
					sep = ",";
				}
			}
			
			if (first) {
				String[] cells = line.split(sep);
				
				first = false;
				for (int c = 0; c < cells.length; c++) {
					String cell = cells[c];
					if (cell.startsWith("\"") && cell.endsWith("\"")) {
						cell = cell.substring(1, cell.length() - 1);
					}
					
					Column column = new Column();
					column.cellIndex = c;
					column.headerLabel = cell;
					
					project.columnModel.columns.add(column);
				}
				
				cellCount = cells.length;
			} else {
				Row row = new Row(cellCount);
				
				if (sep.charAt(0) == ',') {
					parseCSVIntoRow(row, line);
				} else {
					parseTSVIntoRow(row, line);
				}
				
				project.rows.add(row);
			}
		}
		
		redirect(response, "/project.html?project=" + project.id);
	}
	
	static protected void parseTSVIntoRow(Row row, String line) {
		String[] cells = line.split("\t");
		for (int c = 0; c < cells.length; c++) {
			String text = cells[c];
			
			Cell cell = new Cell();
			cell.value = parseCellValue(text);
			
			row.cells.add(cell);
		}
	}
	
	static protected void parseCSVIntoRow(Row row, String line) {
		int start = 0;
		while (start < line.length()) {
			String text = null;
			
			if (line.charAt(start) == '"') {
				int next = line.indexOf('"', start + 1);
				if (next < 0) {
					text = line.substring(start);
					start = line.length();
				} else {
					text = line.substring(start, next + 1);
					start = next + 2;
				}
			} else {
				int next = line.indexOf(',', start);
				if (next < 0) {
					text = line.substring(start);
					start = line.length();
				} else {
					text = line.substring(start, next);
					start = next + 1;
				}
			}
			
			Cell cell = new Cell();
			cell.value = parseCellValue(text);
			
			row.cells.add(cell);
		}
	}
	
	static public Object parseCellValue(String text) {
		if (text.length() > 0) {
			if (text.length() > 1 && text.startsWith("\"") && text.endsWith("\"")) {
				return text.substring(1, text.length() - 1);
			}
			
			try {
				return Long.parseLong(text);
			} catch (NumberFormatException e) {
			}
		
			try {
				return Double.parseDouble(text);
			} catch (NumberFormatException e) {
			}
		}
		return text;
	}
}
